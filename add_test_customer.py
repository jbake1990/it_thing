from app import app, db, Customer
from datetime import datetime

def add_test_customer():
    with app.app_context():
        # Check if test customer already exists
        test_customer = Customer.query.filter_by(name='Test Company').first()
        if not test_customer:
            test_customer = Customer(
                name='Test Company',
                address='123 Test Street',
                contact_person='John Doe',
                phone='555-0123',
                email='john@testcompany.com',
                created_at=datetime.utcnow()
            )
            db.session.add(test_customer)
            db.session.commit()
            print("Test customer added successfully!")
        else:
            print("Test customer already exists!")

if __name__ == '__main__':
    add_test_customer() 