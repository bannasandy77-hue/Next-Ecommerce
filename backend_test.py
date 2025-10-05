#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Ecommerce Application
Tests all authentication, product management, cart, orders, and admin endpoints
"""

import requests
import json
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://buyflow-45.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "admin@shophub.com",
    "password": "admin123"
}

CUSTOMER_CREDENTIALS = {
    "email": "customer@example.com", 
    "password": "customer123"
}

# Global variables to store tokens and IDs
admin_token = None
customer_token = None
test_product_id = None
test_category_id = None
test_order_id = None

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, data=None, token=None, expected_status=200):
    """Make HTTP request with proper headers"""
    url = f"{API_BASE}/{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        print(f"    {method} {url} -> {response.status_code}")
        
        if response.status_code == expected_status:
            try:
                return True, response.json()
            except:
                return True, response.text
        else:
            try:
                error_data = response.json()
                return False, f"Status {response.status_code}: {error_data}"
            except:
                return False, f"Status {response.status_code}: {response.text}"
                
    except Exception as e:
        return False, f"Request failed: {str(e)}"

def test_user_registration():
    """Test POST /api/auth/register"""
    print("🔐 Testing User Registration...")
    
    # Generate unique email for each test run
    import time
    timestamp = int(time.time())
    new_user_data = {
        "email": f"testuser{timestamp}@test.com",
        "password": "newuser123",
        "name": "New Test User",
        "phone": "+1-555-999-8888",
        "address": "123 Test Street, Test City, TC 12345"
    }
    
    success, response = make_request("POST", "auth/register", new_user_data, expected_status=200)
    
    if success and isinstance(response, dict):
        if "user" in response and "token" in response:
            log_test("User Registration", True, f"User created: {response['user']['email']}")
            return True
        else:
            log_test("User Registration", False, "Missing user or token in response")
            return False
    else:
        log_test("User Registration", False, str(response))
        return False

def test_user_login():
    """Test POST /api/auth/login"""
    global admin_token, customer_token
    print("🔐 Testing User Login...")
    
    # Test admin login
    success, response = make_request("POST", "auth/login", ADMIN_CREDENTIALS, expected_status=200)
    
    if success and isinstance(response, dict) and "token" in response:
        admin_token = response["token"]
        log_test("Admin Login", True, f"Admin logged in: {response['user']['email']}")
        admin_success = True
    else:
        log_test("Admin Login", False, str(response))
        admin_success = False
    
    # Test customer login
    success, response = make_request("POST", "auth/login", CUSTOMER_CREDENTIALS, expected_status=200)
    
    if success and isinstance(response, dict) and "token" in response:
        customer_token = response["token"]
        log_test("Customer Login", True, f"Customer logged in: {response['user']['email']}")
        customer_success = True
    else:
        log_test("Customer Login", False, str(response))
        customer_success = False
    
    return admin_success and customer_success

def test_get_current_user():
    """Test GET /api/auth/me"""
    print("🔐 Testing Get Current User...")
    
    if not customer_token:
        log_test("Get Current User", False, "No customer token available")
        return False
    
    success, response = make_request("GET", "auth/me", token=customer_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if "email" in response and response["email"] == CUSTOMER_CREDENTIALS["email"]:
            log_test("Get Current User", True, f"Retrieved user: {response['email']}")
            return True
        else:
            log_test("Get Current User", False, "User data mismatch")
            return False
    else:
        log_test("Get Current User", False, str(response))
        return False

def test_list_products():
    """Test GET /api/products with various parameters"""
    print("📦 Testing Product Listing...")
    
    # Test basic product listing
    success, response = make_request("GET", "products", expected_status=200)
    
    if success and isinstance(response, dict):
        if "products" in response and "pagination" in response:
            products_count = len(response["products"])
            log_test("List Products (Basic)", True, f"Retrieved {products_count} products")
            basic_success = True
        else:
            log_test("List Products (Basic)", False, "Missing products or pagination")
            basic_success = False
    else:
        log_test("List Products (Basic)", False, str(response))
        basic_success = False
    
    # Test with pagination
    success, response = make_request("GET", "products?page=1&limit=3", expected_status=200)
    
    if success and isinstance(response, dict):
        if len(response.get("products", [])) <= 3:
            log_test("List Products (Pagination)", True, f"Pagination working: {len(response['products'])} products")
            pagination_success = True
        else:
            log_test("List Products (Pagination)", False, "Pagination not working")
            pagination_success = False
    else:
        log_test("List Products (Pagination)", False, str(response))
        pagination_success = False
    
    # Test with search
    success, response = make_request("GET", "products?search=headphones", expected_status=200)
    
    if success and isinstance(response, dict):
        log_test("List Products (Search)", True, f"Search working: {len(response.get('products', []))} results")
        search_success = True
    else:
        log_test("List Products (Search)", False, str(response))
        search_success = False
    
    # Test with category filter
    success, response = make_request("GET", "products?category=Electronics", expected_status=200)
    
    if success and isinstance(response, dict):
        log_test("List Products (Category Filter)", True, f"Category filter working: {len(response.get('products', []))} results")
        category_success = True
    else:
        log_test("List Products (Category Filter)", False, str(response))
        category_success = False
    
    return basic_success and pagination_success and search_success and category_success

def test_admin_create_product():
    """Test POST /api/products (admin only)"""
    global test_product_id
    print("📦 Testing Admin Product Creation...")
    
    if not admin_token:
        log_test("Admin Create Product", False, "No admin token available")
        return False
    
    product_data = {
        "name": "Test Product API",
        "description": "A test product created via API for testing purposes",
        "price": 49.99,
        "category": "Electronics",
        "stock": 20,
        "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"],
        "featured": False
    }
    
    success, response = make_request("POST", "products", product_data, token=admin_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if "id" in response and response["name"] == product_data["name"]:
            test_product_id = response["id"]
            log_test("Admin Create Product", True, f"Product created: {response['name']} (ID: {test_product_id})")
            return True
        else:
            log_test("Admin Create Product", False, "Product creation response invalid")
            return False
    else:
        log_test("Admin Create Product", False, str(response))
        return False

def test_admin_update_product():
    """Test PUT /api/products/{id} (admin only)"""
    print("📦 Testing Admin Product Update...")
    
    if not admin_token or not test_product_id:
        log_test("Admin Update Product", False, "No admin token or test product ID available")
        return False
    
    update_data = {
        "name": "Updated Test Product API",
        "description": "Updated description for test product",
        "price": 59.99,
        "category": "Electronics",
        "stock": 15,
        "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500"],
        "featured": True
    }
    
    success, response = make_request("PUT", f"products/{test_product_id}", update_data, token=admin_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if response["name"] == update_data["name"] and response["price"] == update_data["price"]:
            log_test("Admin Update Product", True, f"Product updated: {response['name']}")
            return True
        else:
            log_test("Admin Update Product", False, "Product update data mismatch")
            return False
    else:
        log_test("Admin Update Product", False, str(response))
        return False

def test_list_categories():
    """Test GET /api/categories"""
    print("📂 Testing Categories Listing...")
    
    success, response = make_request("GET", "categories", expected_status=200)
    
    if success and isinstance(response, list):
        if len(response) > 0:
            log_test("List Categories", True, f"Retrieved {len(response)} categories")
            return True
        else:
            log_test("List Categories", False, "No categories found")
            return False
    else:
        log_test("List Categories", False, str(response))
        return False

def test_admin_create_category():
    """Test POST /api/categories (admin only)"""
    global test_category_id
    print("📂 Testing Admin Category Creation...")
    
    if not admin_token:
        log_test("Admin Create Category", False, "No admin token available")
        return False
    
    category_data = {
        "name": "Test Category API",
        "description": "A test category created via API for testing purposes"
    }
    
    success, response = make_request("POST", "categories", category_data, token=admin_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if "id" in response and response["name"] == category_data["name"]:
            test_category_id = response["id"]
            log_test("Admin Create Category", True, f"Category created: {response['name']} (ID: {test_category_id})")
            return True
        else:
            log_test("Admin Create Category", False, "Category creation response invalid")
            return False
    else:
        log_test("Admin Create Category", False, str(response))
        return False

def test_cart_operations():
    """Test all cart operations"""
    print("🛒 Testing Shopping Cart Operations...")
    
    if not customer_token:
        log_test("Cart Operations", False, "No customer token available")
        return False
    
    # First get a product ID to add to cart
    success, products_response = make_request("GET", "products", expected_status=200)
    if not success or not products_response.get("products"):
        log_test("Cart Operations", False, "Cannot get products for cart testing")
        return False
    
    product_id = products_response["products"][0]["id"]
    
    # Test add item to cart
    add_data = {"productId": product_id, "quantity": 2}
    success, response = make_request("POST", "cart/add", add_data, token=customer_token, expected_status=200)
    
    if success:
        log_test("Cart Add Item", True, "Item added to cart successfully")
        add_success = True
    else:
        log_test("Cart Add Item", False, str(response))
        add_success = False
    
    # Test get cart
    success, response = make_request("GET", "cart", token=customer_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if "items" in response and len(response["items"]) > 0:
            log_test("Cart Get Items", True, f"Cart has {len(response['items'])} items")
            get_success = True
        else:
            log_test("Cart Get Items", False, "Cart is empty or invalid")
            get_success = False
    else:
        log_test("Cart Get Items", False, str(response))
        get_success = False
    
    # Test update cart item
    update_data = {"productId": product_id, "quantity": 3}
    success, response = make_request("POST", "cart/update", update_data, token=customer_token, expected_status=200)
    
    if success:
        log_test("Cart Update Item", True, "Cart item updated successfully")
        update_success = True
    else:
        log_test("Cart Update Item", False, str(response))
        update_success = False
    
    # Test remove cart item
    remove_data = {"productId": product_id}
    success, response = make_request("POST", "cart/remove", remove_data, token=customer_token, expected_status=200)
    
    if success:
        log_test("Cart Remove Item", True, "Item removed from cart successfully")
        remove_success = True
    else:
        log_test("Cart Remove Item", False, str(response))
        remove_success = False
    
    return add_success and get_success and update_success and remove_success

def test_order_operations():
    """Test order creation and management"""
    global test_order_id
    print("📋 Testing Order Operations...")
    
    if not customer_token:
        log_test("Order Operations", False, "No customer token available")
        return False
    
    # First add items to cart for order creation
    success, products_response = make_request("GET", "products", expected_status=200)
    if not success or not products_response.get("products"):
        log_test("Order Operations", False, "Cannot get products for order testing")
        return False
    
    product = products_response["products"][0]
    
    # Add item to cart first
    add_data = {"productId": product["id"], "quantity": 1}
    make_request("POST", "cart/add", add_data, token=customer_token)
    
    # Test create order
    order_data = {
        "shippingAddress": {
            "name": "John Doe",
            "address": "123 Test Street",
            "city": "Test City",
            "state": "TC",
            "zipCode": "12345",
            "phone": "+1-555-123-4567"
        },
        "items": [{
            "productId": product["id"],
            "quantity": 1,
            "price": product["price"]
        }],
        "total": product["price"]
    }
    
    success, response = make_request("POST", "orders", order_data, token=customer_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if "id" in response and response["status"] == "pending":
            test_order_id = response["id"]
            log_test("Create Order", True, f"Order created: {test_order_id}")
            create_success = True
        else:
            log_test("Create Order", False, "Order creation response invalid")
            create_success = False
    else:
        log_test("Create Order", False, str(response))
        create_success = False
    
    # Test get orders
    success, response = make_request("GET", "orders", token=customer_token, expected_status=200)
    
    if success and isinstance(response, list):
        if len(response) > 0:
            log_test("Get Orders", True, f"Retrieved {len(response)} orders")
            get_success = True
        else:
            log_test("Get Orders", False, "No orders found")
            get_success = False
    else:
        log_test("Get Orders", False, str(response))
        get_success = False
    
    return create_success and get_success

def test_admin_order_management():
    """Test admin order status updates"""
    print("📋 Testing Admin Order Management...")
    
    if not admin_token or not test_order_id:
        log_test("Admin Order Management", False, "No admin token or test order ID available")
        return False
    
    # Test update order status
    status_data = {"status": "processing"}
    success, response = make_request("PUT", f"orders/{test_order_id}/status", status_data, token=admin_token, expected_status=200)
    
    if success and isinstance(response, dict):
        if response["status"] == "processing":
            log_test("Admin Update Order Status", True, f"Order status updated to: {response['status']}")
            return True
        else:
            log_test("Admin Update Order Status", False, "Order status not updated correctly")
            return False
    else:
        log_test("Admin Update Order Status", False, str(response))
        return False

def test_admin_stats():
    """Test GET /api/admin/stats"""
    print("📊 Testing Admin Dashboard Stats...")
    
    if not admin_token:
        log_test("Admin Stats", False, "No admin token available")
        return False
    
    success, response = make_request("GET", "admin/stats", token=admin_token, expected_status=200)
    
    if success and isinstance(response, dict):
        required_fields = ["totalProducts", "totalOrders", "totalUsers", "totalRevenue"]
        if all(field in response for field in required_fields):
            log_test("Admin Stats", True, f"Stats: {response['totalProducts']} products, {response['totalOrders']} orders, {response['totalUsers']} users")
            return True
        else:
            log_test("Admin Stats", False, "Missing required stats fields")
            return False
    else:
        log_test("Admin Stats", False, str(response))
        return False

def test_security():
    """Test security - unauthorized access to admin endpoints"""
    print("🔒 Testing Security (Unauthorized Access)...")
    
    # Test admin endpoint without token
    success, response = make_request("GET", "admin/stats", expected_status=403)
    
    if not success and "403" in str(response):
        log_test("Security - No Token", True, "Admin endpoint properly protected (403 Forbidden)")
        no_token_success = True
    else:
        log_test("Security - No Token", False, "Admin endpoint not properly protected")
        no_token_success = False
    
    # Test admin endpoint with customer token
    if customer_token:
        success, response = make_request("GET", "admin/stats", token=customer_token, expected_status=403)
        
        if not success and "403" in str(response):
            log_test("Security - Customer Token", True, "Admin endpoint rejects customer access (403 Forbidden)")
            customer_token_success = True
        else:
            log_test("Security - Customer Token", False, "Admin endpoint allows customer access")
            customer_token_success = False
    else:
        customer_token_success = True
    
    return no_token_success and customer_token_success

def test_admin_delete_product():
    """Test DELETE /api/products/{id} (admin only)"""
    print("📦 Testing Admin Product Deletion...")
    
    if not admin_token or not test_product_id:
        log_test("Admin Delete Product", False, "No admin token or test product ID available")
        return False
    
    success, response = make_request("DELETE", f"products/{test_product_id}", token=admin_token, expected_status=200)
    
    if success:
        log_test("Admin Delete Product", True, "Product deleted successfully")
        return True
    else:
        log_test("Admin Delete Product", False, str(response))
        return False

def run_all_tests():
    """Run comprehensive backend API tests"""
    print("🚀 Starting Comprehensive Ecommerce Backend API Testing")
    print("=" * 60)
    print(f"Testing API at: {API_BASE}")
    print("=" * 60)
    
    test_results = []
    
    # Authentication Tests
    test_results.append(("User Registration", test_user_registration()))
    test_results.append(("User Login", test_user_login()))
    test_results.append(("Get Current User", test_get_current_user()))
    
    # Product Tests
    test_results.append(("List Products", test_list_products()))
    test_results.append(("Admin Create Product", test_admin_create_product()))
    test_results.append(("Admin Update Product", test_admin_update_product()))
    
    # Category Tests
    test_results.append(("List Categories", test_list_categories()))
    test_results.append(("Admin Create Category", test_admin_create_category()))
    
    # Cart Tests
    test_results.append(("Cart Operations", test_cart_operations()))
    
    # Order Tests
    test_results.append(("Order Operations", test_order_operations()))
    test_results.append(("Admin Order Management", test_admin_order_management()))
    
    # Admin Tests
    test_results.append(("Admin Stats", test_admin_stats()))
    
    # Security Tests
    test_results.append(("Security Tests", test_security()))
    
    # Cleanup Tests
    test_results.append(("Admin Delete Product", test_admin_delete_product()))
    
    # Summary
    print("=" * 60)
    print("🏁 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 60)
    print(f"Total Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/len(test_results)*100):.1f}%")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! Backend API is working correctly.")
    else:
        print(f"⚠️  {failed} test(s) failed. Please check the issues above.")
    
    return failed == 0

if __name__ == "__main__":
    run_all_tests()