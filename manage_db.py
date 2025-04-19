from app import app, db, User
from werkzeug.security import generate_password_hash
from flask_migrate import upgrade, stamp

def init_db():
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Stamp the database with the current migration version
        stamp()
        
        # Check if admin user exists
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            # Create admin user
            admin = User(
                username='admin',
                password_hash=generate_password_hash('admin'),
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            print("Admin user created successfully!")
        else:
            print("Admin user already exists!")

def upgrade_db():
    with app.app_context():
        # Upgrade to the latest migration
        upgrade()
        print("Database upgraded to latest version!")

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == 'init':
            init_db()
        elif sys.argv[1] == 'upgrade':
            upgrade_db()
    else:
        print("Please specify an operation: init or upgrade") 