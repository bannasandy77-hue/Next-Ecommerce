#!/usr/bin/env node

const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'ecommerce_shop'

async function setupDatabase() {
  console.log('Setting up database...')
  
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  
  // Clear existing data
  await db.collection('users').deleteMany({})
  await db.collection('categories').deleteMany({})
  await db.collection('products').deleteMany({})
  console.log('Cleared existing data')
  
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const adminUser = {
    id: uuidv4(),
    email: 'admin@shophub.com',
    password: adminPassword,
    name: 'Admin User',
    phone: '+1-234-567-8900',
    address: '123 Admin Street, Admin City, AC 12345',
    role: 'admin',
    createdAt: new Date()
  }
  
  await db.collection('users').insertOne(adminUser)
  console.log('Created admin user: admin@shophub.com / admin123')
  
  // Create sample customer
  const customerPassword = await bcrypt.hash('customer123', 10)
  const customerUser = {
    id: uuidv4(),
    email: 'customer@example.com',
    password: customerPassword,
    name: 'John Doe',
    phone: '+1-555-123-4567',
    address: '456 Customer Lane, Customer City, CC 67890',
    role: 'customer',
    createdAt: new Date()
  }
  
  await db.collection('users').insertOne(customerUser)
  console.log('Created customer user: customer@example.com / customer123')
  
  // Create categories
  const categories = [
    {
      id: uuidv4(),
      name: 'Electronics',
      description: 'Smartphones, laptops, gadgets and electronic accessories',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Fashion',
      description: 'Clothing, shoes, accessories and fashion items',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Home & Garden',
      description: 'Home decor, furniture, garden tools and accessories',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Sports & Fitness',
      description: 'Sports equipment, fitness gear and outdoor activities',
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Books & Media',
      description: 'Books, movies, music and educational materials',
      createdAt: new Date()
    }
  ]
  
  await db.collection('categories').insertMany(categories)
  console.log('Created categories')
  
  // Create sample products
  const products = [
    {
      id: uuidv4(),
      name: 'Wireless Bluetooth Headphones',
      description: 'Premium quality wireless headphones with noise cancellation and 30-hour battery life.',
      price: 99.99,
      category: 'Electronics',
      stock: 50,
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500'
      ],
      featured: true,
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Smartphone Pro Max',
      description: 'Latest smartphone with advanced camera system, 5G connectivity and premium design.',
      price: 1099.99,
      category: 'Electronics',
      stock: 25,
      images: [
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'
      ],
      featured: true,
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Designer T-Shirt',
      description: 'Comfortable cotton t-shirt with modern design. Available in multiple colors.',
      price: 29.99,
      category: 'Fashion',
      stock: 100,
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'
      ],
      featured: false,
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Running Sneakers',
      description: 'Professional running shoes with advanced cushioning and breathable material.',
      price: 89.99,
      category: 'Fashion',
      stock: 75,
      images: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'
      ],
      featured: true,
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Coffee Maker Deluxe',
      description: 'Automatic coffee maker with programmable timer and 12-cup capacity.',
      price: 149.99,
      category: 'Home & Garden',
      stock: 30,
      images: [
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500'
      ],
      featured: false,
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: 'Fitness Tracker Watch',
      description: 'Advanced fitness tracker with heart rate monitoring, GPS and 7-day battery life.',
      price: 199.99,
      category: 'Sports & Fitness',
      stock: 40,
      images: [
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=500'
      ],
      featured: true,
      createdAt: new Date()
    }
  ]
  
  await db.collection('products').insertMany(products)
  console.log(`Created ${products.length} sample products`)
  
  await client.close()
  console.log('Database setup completed!')
  console.log('\nLogin credentials:')
  console.log('Admin: admin@shophub.com / admin123')
  console.log('Customer: customer@example.com / customer123')
}

setupDatabase().catch(console.error)