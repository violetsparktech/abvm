const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.primary-nav');

menuButton.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});

navigation.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  });
});

document.querySelector('#year').textContent = new Date().getFullYear();

const admissionForm = document.querySelector('#admission-form');
const formStatus = admissionForm.querySelector('.form-status');
const principalWhatsApp = '918789188947';

admissionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus.textContent = '';
  formStatus.classList.remove('error');
  const whatsappTab = window.open('about:blank', '_blank');
  if (whatsappTab) whatsappTab.opener = null;
  let openedWhatsApp = false;
  const submitButton = admissionForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Sending…';

  try {
    const formData = new FormData(admissionForm);
    const enquiry = {
      guardian_name: formData.get('guardian_name'),
      phone: formData.get('phone'),
      class_interest: formData.get('class_interest'),
      email: formData.get('email'),
      message: formData.get('message')
    };
    let reference = '';
    try {
      const response = await fetch('./api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...enquiry,
          consent: formData.get('consent') === 'on',
          category: 'admissions'
        })
      });
      const responseText = await response.text();
      let result = null;
      if (response.headers.get('content-type')?.includes('application/json')) {
        try {
          result = JSON.parse(responseText);
        } catch {
          result = null;
        }
      }

      if (response.ok && result && typeof result.reference === 'string') {
        reference = result.reference;
      }
    } catch {
      // WhatsApp remains available when the site is opened without its Python backend.
    }

    const whatsappMessage = [
      'Admissions enquiry for Anand Bal Vidya Mandir',
      reference ? `Reference: ${reference}` : '',
      `Parent/guardian: ${enquiry.guardian_name}`,
      `Phone: ${enquiry.phone}`,
      `Class of interest: ${enquiry.class_interest}`,
      enquiry.email ? `Email: ${enquiry.email}` : '',
      enquiry.message ? `Message: ${enquiry.message}` : ''
    ].filter(Boolean).join('\n');
    const whatsappUrl = `https://wa.me/${principalWhatsApp}?text=${encodeURIComponent(whatsappMessage)}`;

    if (whatsappTab) {
      try {
        whatsappTab.location.href = whatsappUrl;
        openedWhatsApp = true;
      } catch {
        whatsappTab.close();
      }
    }

    if (reference) {
      formStatus.textContent = `Enquiry saved (${reference}). Review it in WhatsApp and press Send to deliver it to Principal Anand Kumar.`;
    } else {
      formStatus.textContent = 'WhatsApp can still send your enquiry, but it was not saved to the school database. GitHub Pages is static and cannot run the Python backend; run python server.py locally to enable database storage. ';
    }

    if (!openedWhatsApp) {
      const whatsappLink = document.createElement('a');
      whatsappLink.href = whatsappUrl;
      whatsappLink.target = '_blank';
      whatsappLink.rel = 'noopener noreferrer';
      whatsappLink.textContent = 'Open WhatsApp to send your enquiry.';
      formStatus.append(whatsappLink);
    }
    admissionForm.reset();
  } finally {
    if (whatsappTab && !openedWhatsApp) whatsappTab.close();
    submitButton.disabled = false;
    submitButton.innerHTML = 'Send enquiry on WhatsApp <span aria-hidden="true">→</span>';
  }
});

const assistant = document.querySelector('.assistant');
const assistantToggle = assistant.querySelector('.assistant-toggle');
const assistantPanel = assistant.querySelector('.assistant-panel');
const assistantMessages = assistant.querySelector('.assistant-messages');
const assistantForm = assistant.querySelector('.assistant-form');
const assistantInput = assistant.querySelector('#assistant-input');

function setAssistantOpen(isOpen) {
  assistantPanel.hidden = !isOpen;
  assistantToggle.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) assistantInput.focus();
}

assistantToggle.addEventListener('click', () => setAssistantOpen(assistantPanel.hidden));
assistant.querySelector('.assistant-close').addEventListener('click', () => setAssistantOpen(false));

function addMessage(text, kind) {
  const message = document.createElement('div');
  message.className = `chat-message ${kind}-message`;
  message.textContent = text;
  assistantMessages.append(message);
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

function getFaqAnswer(question) {
  const text = question.toLowerCase();
  if (/admission|apply|application|प्रवेश/.test(text)) return 'To ask about admission, use the enquiry form on this page. The school can confirm current availability, the application process and required documents.';
  if (/class|grade|nursery|कक्षा/.test(text)) return 'Anand Bal Vidya Mandir offers classes from Nursery through Class 8. Please contact the school to confirm current class availability.';
  if (/robot|coding|कोडिंग/.test(text)) return 'The Robotics, AI & Coding Training section describes hands-on learning in making, coding and electronics. The programme is sponsored by Violet Spark Technologies Pvt. Ltd. Use the enquiry form to ask for current details.';
  if (/fee|pay|payment|फीस/.test(text)) return 'Current fee details are not published on this website. Please contact the school office. Online payments are not configured here.';
  if (/report|result|रिपोर्ट/.test(text)) return 'A secure report-card portal is not configured on this website. Please contact the school office for help accessing results.';
  if (/contact|phone|address|संपर्क/.test(text)) return 'Please send a message using the admissions enquiry form on this page. The school team can share its current contact information.';
  if (/facility|facilities|campus/.test(text)) return 'You can see the available school photographs in the School Life section. For current facilities information, please contact the school.';
  return 'I can help with admissions, classes, fees, report cards, school life and robotics. For information not shown on this website, please send an enquiry to the school.';
}

assistant.querySelectorAll('.suggested-questions button').forEach((button) => {
  button.addEventListener('click', () => {
    const question = button.textContent;
    addMessage(question, 'user');
    window.setTimeout(() => addMessage(getFaqAnswer(question), 'assistant'), 180);
  });
});

assistantForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = assistantInput.value.trim();
  if (!question) return;
  addMessage(question, 'user');
  assistantInput.value = '';
  window.setTimeout(() => addMessage(getFaqAnswer(question), 'assistant'), 180);
});
