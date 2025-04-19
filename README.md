# IT Management System

A web-based application for IT technicians to manage customer network information, credentials, and network topology.

## Features

- Secure user authentication
- Customer management
- Network information tracking
- Credential management
- Responsive, modern UI
- Search functionality
- Password visibility toggle

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
- Windows:
```bash
venv\Scripts\activate
```
- Linux/Mac:
```bash
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize the database:
```bash
python
>>> from app import app, db
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

5. Create an admin user:
```bash
python
>>> from app import app, db, User
>>> from werkzeug.security import generate_password_hash
>>> with app.app_context():
...     admin = User(username='admin', password_hash=generate_password_hash('your_password'), is_admin=True)
...     db.session.add(admin)
...     db.session.commit()
>>> exit()
```

6. Run the application:
```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Usage

1. Log in with your admin credentials
2. Add customers using the "Add Customer" button
3. For each customer, you can:
   - Add network information (IP addresses, subnet masks, etc.)
   - Add credentials (usernames, passwords, service information)
   - View and manage all information in a organized interface

## Security Notes

- All passwords are hashed before storage
- The application uses secure session management
- IP addresses are validated before storage
- Credentials are masked by default with a visibility toggle

## Requirements

- Python 3.8+
- Flask
- SQLAlchemy
- Flask-Login
- Flask-WTF
- Werkzeug
- python-dotenv
- cryptography

## License

This project is licensed under the MIT License. 