# Anand Bal Vidya Mandir website

A lightweight school website built with plain HTML, CSS and JavaScript, served by Python's standard library. The included Python backend stores admissions enquiries in SQLite. No third-party Python packages or frontend framework are required.

## Run locally

1. Install Python 3.9 or newer.
2. Open a terminal in this folder.
3. Run `python server.py`.
4. Visit `http://127.0.0.1:8000`.

The server creates `abvm.sqlite3` on first startup. Set `ABVM_DATABASE` to use a different database path. `ABVM_HOST` and `ABVM_PORT` can configure the bind address and port; the default bind address is loopback-only.

## Deploy to GitHub Pages

This repository is also deployable as a static site: in the GitHub repository, open **Settings → Pages**, choose **Deploy from a branch**, select the branch containing the site and the repository root (`/`), then save. GitHub Pages will publish `index.html`; the site's relative asset links work both at the project URL and on a local server.

GitHub Pages does not run `server.py` or provide its SQLite database. On the published site, admissions enquiries can still be opened in WhatsApp, but they are not saved to the database. Run `python server.py` locally when database-backed enquiry storage is needed.

## Included

- Responsive school landing page with the supplied ABVM photos and logo.
- Sections for school introduction, learning stages, school life, robotics, admissions, FAQs and contact.
- Robotics sponsor attribution and link for Violet Spark Technologies Pvt. Ltd.
- Staff fee payment receipt tool at `/fee-receipt.html`: enter the student and session, fee heads, received amount, cash or verified online payment details; calculate the total and remaining balance; and print or save a receipt as PDF.
- Receipt form data remains in the browser and is not stored in the website database. Receipt numbers are generated locally, not registered centrally. The tool does not verify payments or replace an authorized accounting system; staff must verify cash/online payments before issuing a receipt.
- Mobile navigation, admissions enquiry submission, and a client-side FAQ assistant based only on the information on the page.
- `POST /api/enquiries` validates and stores enquiries in SQLite and returns a reference. After successful submission, the form opens a prefilled WhatsApp message to Principal Anand Kumar at 8789188947; the visitor must review and press Send in WhatsApp.
- When opened using a static preview such as VS Code Live Server, the WhatsApp message still opens, but the enquiry cannot be saved because the Python API is not running. Start the website with `python server.py` to enable database storage.
- `GET /api/health` provides a simple local health check.

## Not configured

This is a public website starter, not the complete school-management platform described in the original brief. It does not provide authenticated admin, parent or student portals; admission review; student records; fee ledgers; payment processing; report cards; notifications; or a cloud AI service. Do not collect sensitive student documents, publish private student information, or accept payments through this site. No payment is simulated. Configure and security-review any such services before deployment.

The page intentionally asks families to contact the school for current fee, contact, class availability and policy details rather than inventing them. Confirm image permissions, privacy notices and applicable child-data protection requirements before public launch. Fonts use local system fallbacks; no third-party frontend libraries or services are required.
