using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Fidelis.Desktop;

/// <summary>
/// Google sign-in for sync, the way Google recommends for desktop apps: the user signs in on
/// Google's own page in their default browser (Fidelis never sees the password), Google sends
/// the answer back to a one-off local address, and Fidelis keeps only a refresh token,
/// encrypted for the current Windows user (DPAPI). Access is limited to Fidelis's hidden Drive
/// folder and can be withdrawn from the Google account at any time.
/// </summary>
internal sealed class GoogleAuth
{
    private const string Scopes = "openid email https://www.googleapis.com/auth/drive.appdata";
    private const string AuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private const string RevokeEndpoint = "https://oauth2.googleapis.com/revoke";
    private static readonly TimeSpan SignInTimeout = TimeSpan.FromMinutes(5);
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Fidelis.GoogleAuth");

    private static readonly HttpClient Http = new();
    private static readonly string SessionFile = Path.Combine(AppPaths.DataDirectory, "google.dat");
    private static readonly string ClientFile = Path.Combine(AppPaths.AppDirectory, "google-oauth.json");

    private string? _accessToken;
    private DateTimeOffset _accessTokenExpires;

    private sealed record Session(string RefreshToken, string Email);

    private sealed record Client(string Id, string Secret);

    public string? Account => LoadSession()?.Email;

    public async Task<string> SignInAsync()
    {
        var client = LoadClient();
        var verifier = RandomString();
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var state = RandomString();

        // A one-off listener on a free local port receives Google's answer.
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var redirectUri = $"http://127.0.0.1:{((IPEndPoint)listener.LocalEndpoint).Port}";

        var url = AuthEndpoint + "?" + Query(new()
        {
            ["client_id"] = client.Id,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = Scopes,
            ["code_challenge"] = challenge,
            ["code_challenge_method"] = "S256",
            ["state"] = state,
            ["access_type"] = "offline",
            ["prompt"] = "consent select_account",
        });
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });

        var parameters = await ReceiveRedirectAsync(listener);
        if (parameters.GetValueOrDefault("state") != state) throw new InvalidOperationException("Respuesta de Google no válida.");
        if (parameters.TryGetValue("error", out var error))
        {
            throw new OperationCanceledException(error == "access_denied" ? "Has cancelado la conexión con Google." : error);
        }

        var tokens = await PostAsync(TokenEndpoint, new()
        {
            ["code"] = parameters["code"],
            ["client_id"] = client.Id,
            ["client_secret"] = client.Secret,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
            ["code_verifier"] = verifier,
        });
        var refreshToken = tokens["refresh_token"]?.GetValue<string>()
            ?? throw new InvalidOperationException("Google no ha devuelto una sesión duradera.");
        var email = EmailFromIdToken(tokens["id_token"]?.GetValue<string>()) ?? "tu cuenta de Google";
        SaveSession(new Session(refreshToken, email));
        RememberAccessToken(tokens);
        Log.Write("google: connected");
        return email;
    }

    public async Task<string> GetAccessTokenAsync()
    {
        if (_accessToken is not null && DateTimeOffset.UtcNow < _accessTokenExpires) return _accessToken;
        var session = LoadSession() ?? throw new InvalidOperationException("Conecta tu cuenta de Google en Ajustes.");
        var client = LoadClient();
        try
        {
            RememberAccessToken(await PostAsync(TokenEndpoint, new()
            {
                ["refresh_token"] = session.RefreshToken,
                ["client_id"] = client.Id,
                ["client_secret"] = client.Secret,
                ["grant_type"] = "refresh_token",
            }));
        }
        catch (HttpRequestException error) when (error.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized)
        {
            // The access was withdrawn from the Google account (or expired): start over.
            File.Delete(SessionFile);
            throw new InvalidOperationException("Google ha retirado el acceso. Vuelve a conectar la cuenta en Ajustes.");
        }
        return _accessToken!;
    }

    public void DiscardAccessToken() => _accessToken = null;

    public async Task SignOutAsync()
    {
        var session = LoadSession();
        File.Delete(SessionFile);
        _accessToken = null;
        if (session is not null)
        {
            try
            {
                await Http.PostAsync(RevokeEndpoint + "?" + Query(new() { ["token"] = session.RefreshToken }), null);
            }
            catch (HttpRequestException)
            {
                // Offline: the local session is gone anyway; the grant can be removed from the account.
            }
        }
        Log.Write("google: disconnected");
    }

    // ---- Helpers ------------------------------------------------------------------------

    private static async Task<Dictionary<string, string>> ReceiveRedirectAsync(TcpListener listener)
    {
        using var timeout = new CancellationTokenSource(SignInTimeout);
        var result = new TaskCompletionSource<Dictionary<string, string>>(TaskCreationOptions.RunContinuationsAsynchronously);
        using var registration = timeout.Token.Register(() =>
            result.TrySetException(new TimeoutException("No se ha completado la conexión con Google a tiempo.")));

        // Browsers may open spare connections (or ask for a favicon): handle each one on its
        // own until Google's redirect arrives.
        _ = Task.Run(async () =>
        {
            while (!result.Task.IsCompleted)
            {
                TcpClient connection;
                try
                {
                    connection = await listener.AcceptTcpClientAsync(timeout.Token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                _ = HandleConnectionAsync(connection, result, timeout.Token);
            }
        });
        return await result.Task;
    }

    private static async Task HandleConnectionAsync(
        TcpClient connection, TaskCompletionSource<Dictionary<string, string>> result, CancellationToken cancellation)
    {
        using var _ = connection;
        try
        {
            var stream = connection.GetStream();
            using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
            using var readTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            readTimeout.CancelAfter(TimeSpan.FromSeconds(30));
            var requestLine = await reader.ReadLineAsync(readTimeout.Token) ?? "";
            // "GET /?code=...&state=... HTTP/1.1"
            var target = requestLine.Split(' ').ElementAtOrDefault(1) ?? "/";
            var query = target.Contains('?') ? target[(target.IndexOf('?') + 1)..] : "";
            var parameters = query.Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(pair => pair.Split('=', 2))
                .ToDictionary(pair => Uri.UnescapeDataString(pair[0]), pair => Uri.UnescapeDataString(pair.ElementAtOrDefault(1) ?? ""));

            if (!parameters.ContainsKey("code") && !parameters.ContainsKey("error"))
            {
                await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), cancellation);
                return;
            }
            await WriteResultPageAsync(stream, parameters.ContainsKey("code"), cancellation);
            result.TrySetResult(parameters);
        }
        catch (Exception error) when (error is IOException or OperationCanceledException or SocketException)
        {
            // A spare connection that never sent anything.
        }
    }

    private static async Task WriteResultPageAsync(Stream stream, bool ok, CancellationToken cancellation)
    {
        var html = $"""
            <!doctype html><html lang="es"><meta charset="utf-8"><title>Fidelis</title>
            <body style="background:#0d0d0d;color:#f2f2f0;font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0">
            <div style="text-align:center"><h1 style="font-size:22px">{(ok ? "Fidelis ya está conectada con Google" : "No se ha conectado")}</h1>
            <p style="color:#9a9a96">Puedes cerrar esta pestaña y volver a Fidelis.</p></div></body></html>
            """;
        var body = Encoding.UTF8.GetBytes(html);
        var header = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
        await stream.WriteAsync(header, cancellation);
        await stream.WriteAsync(body, cancellation);
    }

    private static async Task<JsonNode> PostAsync(string url, Dictionary<string, string> form)
    {
        using var response = await Http.PostAsync(url, new FormUrlEncodedContent(form));
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Google respondió {(int)response.StatusCode}", null, response.StatusCode);
        }
        return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }

    private void RememberAccessToken(JsonNode tokens)
    {
        _accessToken = tokens["access_token"]!.GetValue<string>();
        var lifetime = tokens["expires_in"]?.GetValue<int>() ?? 3600;
        _accessTokenExpires = DateTimeOffset.UtcNow.AddSeconds(lifetime - 120);
    }

    private static string? EmailFromIdToken(string? idToken)
    {
        var payload = idToken?.Split('.').ElementAtOrDefault(1);
        if (payload is null) return null;
        payload = payload.Replace('-', '+').Replace('_', '/');
        payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        return JsonNode.Parse(Convert.FromBase64String(payload))?["email"]?.GetValue<string>();
    }

    private static Client LoadClient()
    {
        if (!File.Exists(ClientFile)) throw new InvalidOperationException("Esta copia de Fidelis no tiene configurada la conexión con Google.");
        var json = JsonNode.Parse(File.ReadAllText(ClientFile))!;
        return new Client(json["client_id"]!.GetValue<string>(), json["client_secret"]!.GetValue<string>());
    }

    private static Session? LoadSession()
    {
        try
        {
            if (!File.Exists(SessionFile)) return null;
            var json = ProtectedData.Unprotect(File.ReadAllBytes(SessionFile), Entropy, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<Session>(json);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static void SaveSession(Session session)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(session);
        File.WriteAllBytes(SessionFile, ProtectedData.Protect(json, Entropy, DataProtectionScope.CurrentUser));
    }

    private static string RandomString() => Base64Url(RandomNumberGenerator.GetBytes(32));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Query(Dictionary<string, string> values) =>
        string.Join("&", values.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
}
