import { fillName, greeting } from '@/utils/personalization';

describe('greeting', () => {
  test.each([
    [6, 'Buenos días, Willy'],
    [12, 'Buenos días, Willy'],
    [13, 'Buenas tardes, Willy'],
    [20, 'Buenas tardes, Willy'],
    [21, 'Buenas noches, Willy'],
    [0, 'Buenas noches, Willy'],
    [5, 'Buenas noches, Willy'],
  ])('%i h → %s', (hour, expected) => {
    expect(greeting(hour, 'Willy')).toBe(expected);
  });

  test('without a name it is just the salutation', () => {
    expect(greeting(9, null)).toBe('Buenos días');
    expect(greeting(9, '   ')).toBe('Buenos días');
  });

  test('trims the name', () => {
    expect(greeting(22, '  Ana ')).toBe('Buenas noches, Ana');
  });
});

describe('fillName', () => {
  test('replaces every placeholder, case-insensitively', () => {
    expect(fillName('{nombre}, hola {NOMBRE}', 'Ana')).toBe('Ana, hola Ana');
  });

  test('drops the placeholder and its comma without a name', () => {
    expect(fillName('{nombre}, a registrar.', null)).toBe('A registrar.');
    expect(fillName('Venga {nombre}, ¡tú puedes!', '')).toBe('Venga ¡tú puedes!');
    expect(fillName('¡Vamos, {nombre}!', null)).toBe('¡Vamos!');
  });
});
