from app import app, db, User
from werkzeug.security import generate_password_hash
import os

def create_admin_user():
    with app.app_context():
        # Check if admin user already exists
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            # Create new admin user
            admin = User(
                username='admin',
                password_hash=generate_password_hash('admin123'),  # Change this password
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully!")
        else:
            print("Admin user already exists.")

if __name__ == '__main__':
    create_admin_user() 