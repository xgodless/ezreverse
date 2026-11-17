'use strict';

const mod = (n, p) => ((n % p) + p) % p;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ+';
const superscript = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const subscript = '₀₁₂₃₄₅₆₇₈₉';
const formatIndex = (number, digits) => String(number).replace(/\d/g, (digit) => digits[digit]);
const power = (variable, degree) => degree === 0 ? '1' : degree === 1 ? variable : variable + formatIndex(degree, superscript);
const symbol = (index) => index === 0 ? 'sₙ' : 'sₙ₊' + formatIndex(index, subscript);

function sumOfTerms(coefficients, term) {
  return coefficients.flatMap((weight, index) => {
    if (weight === 0) return [];
    const label = term(index);
    return [label === '1' ? String(weight) : (weight === 1 ? '' : weight) + label];
  }).join(' + ') || '0';
}

function polynomial(coefficients, variable = 'x') {
  return sumOfTerms([...coefficients].reverse(), (i) => power(variable, coefficients.length - i - 1));
}

function recurrence(coefficients) {
  return `${symbol(coefficients.length)} = ${sumOfTerms(coefficients, symbol)}`;
}

function characteristic(coefficients, p) {
  return polynomial([...coefficients.map((value) => mod(-value, p)), 1]);
}

function readList(value, max, label, limit = 64) {
  const pieces = value.trim().split(/[\s,;]+/u);
  const numbers = pieces.map(Number);
  if (pieces.length > limit || pieces.some((piece, i) => !/^\d+$/u.test(piece) || numbers[i] > max)) {
    throw new Error(`${label}: укажите до ${limit} целых чисел от 0 до ${max}.`);
  }
  return numbers;
}

function solveLinear(rows, columns, p) {
  const pivots = [];
  for (let column = 0; column < columns; column++) {
    const target = pivots.length;
    const pivot = rows.findIndex((row, i) => i >= target && row[column] !== 0);
    if (pivot < 0) continue;
    [rows[target], rows[pivot]] = [rows[pivot], rows[target]];
    const row = rows[target];
    let inverse = 1;
    while (mod(inverse * row[column], p) !== 1) inverse++;
    rows[target] = row.map((value) => mod(value * inverse, p));
    for (const [i, current] of rows.entries()) {
      if (i === target || current[column] === 0) continue;
      const factor = current[column];
      rows[i] = current.map((value, j) => mod(value - factor * rows[target][j], p));
    }
    pivots.push(column);
  }
  if (rows.slice(pivots.length).some((row) => row[columns] !== 0)) return null;
  const solution = Array(columns).fill(0);
  for (const [i, pivot] of pivots.entries()) solution[pivot] = rows[i][columns];
  return solution;
}

function minimalRecurrence(block, p) {
  for (let degree = 0; degree <= block.length; degree++) {
    const rows = block.map((_, i) => Array.from({ length: degree + 1 }, (_, j) => block[(i + j) % block.length]));
    const values = solveLinear(rows, degree, p);
    if (values) return values;
  }
  throw new Error('Не удалось построить соотношение.');
}

function compactPeriod(block) {
  for (let size = 1; size <= block.length; size++) {
    if (block.length % size === 0 && block.every((value, i) => value === block[i % size])) return block.slice(0, size);
  }
}

function minimalTask({ modulus, period }) {
  const p = Number(modulus);
  if (!/^\d+$/u.test(modulus.trim()) || p < 2 || p > 251 || Array.from({ length: Math.floor(Math.sqrt(p)) - 1 }, (_, i) => i + 2).some((d) => p % d === 0)) {
    throw new Error('Укажите простой модуль от 2 до 251.');
  }
  const block = compactPeriod(readList(period, p - 1, 'Повторяющийся блок'));
  const coefficients = minimalRecurrence(block, p);
  const degree = coefficients.length;
  const proof = degree === 0 ? 'Все члены последовательности равны нулю.' :
    `Для каждого сдвига блока составляем уравнение Σ cⱼ·sₙ₊ⱼ = sₙ₊${formatIndex(degree, subscript)}. Первая совместная система имеет ${degree} ${degree === 1 ? 'неизвестную' : 'неизвестных'}.`;
  return [
    ['Период', `${block.length}. Повторяется блок (${block.join(', ')}).`],
    ['Как найдено соотношение', proof],
    ['Минимальное соотношение', `${recurrence(coefficients)}  (mod ${p})`, 'result-value'],
    ['Аннулирующий многочлен', characteristic(coefficients, p), 'result-value'],
    ['Регистр с обратной связью', degree === 0 ? 'На выходе всегда 0.' : `Ячеек: ${degree}. Начальное состояние: (${block.slice(0, degree).join(', ')}). Выход — первая ячейка. На каждом шаге сдвигаем значения влево, а в последнюю ячейку записываем ${sumOfTerms(coefficients, symbol)} по модулю ${p}.`],
  ];
}

function nextState(state, coefficients, p) {
  const next = coefficients.reduce((sum, value, i) => sum + value * state[i], 0);
  return [...state.slice(1), mod(next, p)];
}

function orbit(seed, coefficients, p) {
  const seen = new Map();
  const output = [];
  let state = seed;
  while (!seen.has(state.join(','))) {
    seen.set(state.join(','), output.length);
    output.push(state[0]);
    state = nextState(state, coefficients, p);
  }
  const prefix = seen.get(state.join(','));
  return { prefix: output.slice(0, prefix), cycle: output.slice(prefix) };
}

function gammaStream(seed, coefficients, length) {
  const digits = [...seed];
  for (let i = 3; i < length; i++) {
    const sum = coefficients.reduce((value, coefficient, j) => value + coefficient * digits[i - 3 + j], 0);
    digits.push(mod(sum, 3));
  }
  return digits.slice(0, length);
}

function matrixOrder(matrix) {
  const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let current = identity;
  for (let order = 1; order <= 11232; order++) {
    current = current.map((row) => row.map((_, col) => mod(row.reduce((sum, value, i) => sum + value * matrix[i][col], 0), 3)));
    if (current.every((row, j) => row.every((value, col) => value === identity[j][col]))) return order;
  }
  throw new Error('Не удалось определить порядок матрицы.');
}

function textInput(text, label) {
  const result = text.toUpperCase().replace(/\s+/gu, '');
  if (!/^[A-Z+]+$/u.test(result)) throw new Error(`${label}: используйте буквы A–Z и символ +.`);
  return result;
}

function trits(number) {
  return number.toString(3).padStart(3, '0');
}

function transformText(text, gamma, sign) {
  return Array.from(text, (letter, i) => {
    const digits = [...trits(alphabet.indexOf(letter))];
    const number = digits.reduce((total, digit, j) => total * 3 + mod(Number(digit) + sign * gamma[3 * i + j], 3), 0);
    return alphabet[number];
  }).join('');
}

function streamTask({ coefficients: input, seed: initial, plain: readable, cipher: encrypted }) {
  const coefficients = readList(input, 2, 'Коэффициенты', 3);
  const seed = readList(initial, 2, 'Начальные значения', 3);
  if (coefficients.length !== 3 || seed.length !== 3) throw new Error('Введите ровно три коэффициента и три начальных значения.');
  const plain = textInput(readable, 'Открытый текст');
  const cipher = textInput(encrypted, 'Шифртекст');
  const gamma = gammaStream(seed, coefficients, 3 * Math.max(plain.length, cipher.length));
  const [c0, c1, c2] = coefficients;
  const matrix = [[0, 0, c0], [1, 0, c1], [0, 1, c2]];
  const order = c0 === 0 ? 'При c₀ = 0 матрица необратима. Порядок матрицы и порядок многочлена не определены.' :
    `Порядок матрицы и характеристического многочлена: ${matrixOrder(matrix)}.`;
  const { prefix, cycle } = orbit(seed, coefficients, 3);
  return [
    ['Рекурсия над ℤ₃', recurrence(coefficients), 'result-value'],
    ['Гамма', `${gamma.slice(0, 36).join('').match(/.{1,3}/gu).join(' ')}${gamma.length > 36 ? ' …' : ''}
Каждая буква — три троичных разряда. A = 000, Z = 221, + = 222. Гамма прибавляется или вычитается поразрядно по модулю 3.`, 'pre'],
    ['Результат шифрования', transformText(plain, gamma, 1), 'result-value'],
    ['Результат расшифрования', transformText(cipher, gamma, -1), 'result-value'],
    ['Ассоциированная матрица для вектора-строки', matrix.map((row) => row.join('  ')).join('\n'), 'pre'],
    ['Характеристический многочлен', characteristic(coefficients, 3), 'result-value'],
    ['Порядок и период', `${order} Минимальный период ключа: ${compactPeriod(cycle).length}.${prefix.length ? ` Длина предпериода: ${prefix.length}.` : ''}`],
  ];
}

function maskFromExpression(input, variable, maximumDegree) {
  const clean = input.toLowerCase().replace(/\s+/gu, '').replace(/\*\*/gu, '^')
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gu, (digits) => '^' + Array.from(digits, (digit) => superscript.indexOf(digit)).join(''));
  if (clean === '0') return 0;
  let mask = 0;
  for (const term of clean.split('+')) {
    const match = term.match(new RegExp('^' + variable + '(?:\\^(\\d+))?$', 'u'));
    const degree = term === '1' ? 0 : match ? Number(match[1] ?? 1) : Infinity;
    if (degree > maximumDegree) throw new Error(`Проверьте запись «${input}». Допустимы степени от 0 до ${maximumDegree}.`);
    mask ^= 1 << degree;
  }
  return mask;
}

function coefficientsOf(mask, size) {
  return Array.from({ length: size }, (_, index) => (mask >> index) & 1);
}

function fieldProduct(a, b, g) {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 16) a ^= g;
  }
  return result;
}

function fieldTask({ g: modulus, beta: input }) {
  const g = maskFromExpression(modulus, 'x', 4);
  if (![0b10011, 0b11001, 0b11111].includes(g)) throw new Error('Многочлен g(x) должен быть неприводимым многочленом степени 4 над ℤ₂.');
  const beta = maskFromExpression(input.replace(/alpha/giu, 'α').replace(/a/giu, 'α'), 'α', 3);
  const conjugates = [];
  let root = beta;
  do {
    conjugates.push(root);
    root = fieldProduct(root, root, g);
  } while (root !== beta);
  let minimum = [1];
  for (const element of conjugates) {
    minimum = [...minimum, 0].map((coefficient, index) => fieldProduct(coefficient, element, g) ^ (minimum[index - 1] ?? 0));
  }
  const degree = minimum.length - 1;
  const seed = Array(degree).fill(0);
  if (beta !== 0) seed[0] = 1;
  const coefficients = minimum.slice(0, -1);
  const { cycle } = orbit(seed, coefficients, 2);
  const roots = conjugates.map((value) => polynomial(coefficientsOf(value, 4), 'α'));
  return [
    ['Сопряжённые β, β², …', roots.join('  →  '), 'result-value'],
    ['Минимальный многочлен', `mβ(x) = ${polynomial(minimum)}`, 'result-value'],
    ['Двоичная рекурсия', recurrence(coefficients), 'result-value'],
    ['Начальное состояние и период', `(${seed.join(', ')}). Максимальный минимальный период: ${cycle.length}.`],
    ['Один период', cycle.join(' '), 'pre'],
  ];
}

const solvers = { minimal: minimalTask, stream: streamTask, field: fieldTask };

function makeElement(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

for (const form of document.querySelectorAll('form[data-solver]')) {
  const result = form.nextElementSibling;
  form.addEventListener('input', () => { result.hidden = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    result.replaceChildren();
    try {
      const data = Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.value]));
      const blocks = solvers[form.dataset.solver](data);
      result.append(makeElement('h4', 'Решение'));
      for (const [title, value, format] of blocks) {
        result.append(makeElement('p', title, 'result-label'), makeElement(format === 'pre' ? 'pre' : 'p', value, format === 'result-value' ? format : undefined));
      }
    } catch (error) {
      result.append(makeElement('p', error.message, 'error'));
    }
    result.hidden = false;
  });
}
