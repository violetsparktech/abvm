const receiptForm = document.querySelector('#receipt-form');
const feeLines = document.querySelector('#fee-lines');
const totalAmount = document.querySelector('#total-amount');
const amountReceived = document.querySelector('#amount-received');
const balanceDue = document.querySelector('#balance-due');
const paymentMethod = document.querySelector('#payment-method');
const transactionField = document.querySelector('#transaction-field');
const transactionReference = document.querySelector('#transaction-reference');
const formError = document.querySelector('#form-error');
const receiptOutput = document.querySelector('#receipt-output');

function parsePaise(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

function formatRupees(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paise / 100);
}

function updateAmounts() {
  const totalPaise = [...feeLines.querySelectorAll('.fee-amount')]
    .reduce((sum, input) => sum + parsePaise(input.value), 0);
  const receivedPaise = parsePaise(amountReceived.value);
  totalAmount.value = (totalPaise / 100).toFixed(2);
  balanceDue.textContent = formatRupees(Math.max(0, totalPaise - receivedPaise));
}

function addFeeLine(description = '', amount = '') {
  const row = document.createElement('div');
  row.className = 'fee-line';

  const descriptionInput = document.createElement('input');
  descriptionInput.className = 'fee-description';
  descriptionInput.maxLength = 100;
  descriptionInput.placeholder = 'e.g. Tuition fee';
  descriptionInput.required = true;
  descriptionInput.value = description;
  descriptionInput.setAttribute('aria-label', 'Fee head description');

  const amountInput = document.createElement('input');
  amountInput.className = 'fee-amount';
  amountInput.type = 'number';
  amountInput.min = '0.01';
  amountInput.step = '0.01';
  amountInput.placeholder = '0.00';
  amountInput.required = true;
  amountInput.value = amount;
  amountInput.setAttribute('aria-label', 'Fee head amount in rupees');

  const removeButton = document.createElement('button');
  removeButton.className = 'remove-line';
  removeButton.type = 'button';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', 'Remove fee head');
  removeButton.addEventListener('click', () => {
    row.remove();
    if (!feeLines.children.length) addFeeLine();
    updateAmounts();
  });

  amountInput.addEventListener('input', updateAmounts);
  row.append(descriptionInput, amountInput, removeButton);
  feeLines.append(row);
}

function setDefaultDate() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  receiptForm.elements.receipt_date.value = localDate;
}

function generateReceiptNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');
  const randomPart = window.crypto?.getRandomValues
    ? [...window.crypto.getRandomValues(new Uint8Array(3))]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ABVM-${date}-${randomPart}`;
}

const numberWords = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
];
const tensWords = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function underThousandWords(number) {
  if (number < 20) return numberWords[number];
  if (number < 100) return `${tensWords[Math.floor(number / 10)]}${number % 10 ? ` ${numberWords[number % 10]}` : ''}`;
  return `${numberWords[Math.floor(number / 100)]} hundred${number % 100 ? ` ${underThousandWords(number % 100)}` : ''}`;
}

function integerToIndianWords(number) {
  if (number === 0) return 'zero';
  const parts = [];
  const crore = Math.floor(number / 10_000_000);
  const lakh = Math.floor((number % 10_000_000) / 100_000);
  const thousand = Math.floor((number % 100_000) / 1000);
  const remainder = number % 1000;
  if (crore) parts.push(`${underThousandWords(crore)} crore`);
  if (lakh) parts.push(`${underThousandWords(lakh)} lakh`);
  if (thousand) parts.push(`${underThousandWords(thousand)} thousand`);
  if (remainder) parts.push(underThousandWords(remainder));
  return parts.join(' ');
}

function amountInWords(paise) {
  const rupees = Math.floor(paise / 100);
  const remainingPaise = paise % 100;
  const rupeeText = `${integerToIndianWords(rupees)} ${rupees === 1 ? 'rupee' : 'rupees'}`;
  return remainingPaise
    ? `${rupeeText} and ${integerToIndianWords(remainingPaise)} ${remainingPaise === 1 ? 'paisa' : 'paise'} only`
    : `${rupeeText} only`;
}

function setOutput(id, value, fallback = '—') {
  document.querySelector(`#${id}`).textContent = value || fallback;
}

function formatReceiptDate(dateValue) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${dateValue}T00:00:00`));
}

function renderReceipt(data) {
  const totalPaise = [...feeLines.querySelectorAll('.fee-amount')]
    .reduce((sum, input) => sum + parsePaise(input.value), 0);
  const paidPaise = parsePaise(data.amount_received);
  const remainingPaise = Math.max(0, totalPaise - paidPaise);

  setOutput('out-receipt-number', generateReceiptNumber());
  setOutput('out-date', formatReceiptDate(data.receipt_date));
  setOutput('out-student', data.student_name);
  setOutput('out-class', data.student_class);
  setOutput('out-session', data.academic_session);
  setOutput('out-guardian', data.guardian_name);
  setOutput('out-student-id', data.student_id);
  setOutput('out-method', data.payment_method);
  setOutput('out-reference', data.transaction_reference);
  setOutput('out-paid', formatRupees(paidPaise));
  setOutput('out-balance', formatRupees(remainingPaise));
  setOutput('out-total', formatRupees(totalPaise));
  setOutput('out-received-by', data.received_by);
  setOutput('out-amount-words', amountInWords(paidPaise));

  const outputFeeLines = document.querySelector('#out-fee-lines');
  outputFeeLines.replaceChildren();
  feeLines.querySelectorAll('.fee-line').forEach((row) => {
    const description = row.querySelector('.fee-description').value.trim();
    const amount = parsePaise(row.querySelector('.fee-amount').value);
    const tableRow = document.createElement('tr');
    const descriptionCell = document.createElement('td');
    const amountCell = document.createElement('td');
    descriptionCell.textContent = description;
    amountCell.textContent = formatRupees(amount);
    tableRow.append(descriptionCell, amountCell);
    outputFeeLines.append(tableRow);
  });

  const remarks = document.querySelector('#out-remarks');
  remarks.textContent = data.remarks;
  remarks.hidden = !data.remarks;
  receiptOutput.hidden = false;
  receiptOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

paymentMethod.addEventListener('change', () => {
  const isOnline = paymentMethod.value !== '' && paymentMethod.value !== 'Cash';
  transactionField.hidden = !isOnline;
  transactionReference.required = isOnline;
  if (!isOnline) transactionReference.value = '';
});

document.querySelector('#add-line').addEventListener('click', () => addFeeLine());
amountReceived.addEventListener('input', updateAmounts);
document.querySelector('#print-receipt').addEventListener('click', () => window.print());

receiptForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formError.textContent = '';
  updateAmounts();

  const totalPaise = [...feeLines.querySelectorAll('.fee-amount')]
    .reduce((sum, input) => sum + parsePaise(input.value), 0);
  const paidPaise = parsePaise(amountReceived.value);
  if (totalPaise < 1) {
    formError.textContent = 'Enter at least one fee head with an amount greater than zero.';
    return;
  }
  if (paidPaise < 1) {
    formError.textContent = 'Enter the amount received.';
    amountReceived.focus();
    return;
  }
  if (paidPaise > totalPaise) {
    formError.textContent = 'The amount received cannot be greater than the total fee amount.';
    amountReceived.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(receiptForm).entries());
  renderReceipt(data);
});

addFeeLine();
setDefaultDate();
