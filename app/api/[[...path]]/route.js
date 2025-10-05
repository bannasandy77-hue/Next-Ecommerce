import { MongoClient } from 'mongodb'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

let client
let db

async function connectDB() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME || 'ecommerce')
  }
  return db
}

// Middleware to verify JWT token
function verifyToken(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  
  const token = authHeader.split(' ')[1]
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// Helper to check admin role
function isAdmin(user) {
  return user && user.role === 'admin'
}

export async function GET(request) {
  try {
    const db = await connectDB()
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/', '')
    const searchParams = url.searchParams

    // Auth routes
    if (path === 'auth/me') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const userDoc = await db.collection('users').findOne({ id: user.id })
      if (!userDoc) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      const { password, ...userWithoutPassword } = userDoc
      return NextResponse.json(userWithoutPassword)
    }

    // Products routes
    if (path === 'products') {
      const category = searchParams.get('category')
      const search = searchParams.get('search')
      const featured = searchParams.get('featured')
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '12')
      const skip = (page - 1) * limit
      
      let filter = {}
      if (category && category !== 'all') {
        filter.category = category
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      }
      if (featured === 'true') {
        filter.featured = true
      }
      
      const products = await db.collection('products')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
      
      const total = await db.collection('products').countDocuments(filter)
      
      return NextResponse.json({
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      })
    }

    if (path.startsWith('products/')) {
      const productId = path.split('/')[1]
      const product = await db.collection('products').findOne({ id: productId })
      
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      return NextResponse.json(product)
    }

    // Categories routes
    if (path === 'categories') {
      const categories = await db.collection('categories').find({}).sort({ name: 1 }).toArray()
      return NextResponse.json(categories)
    }

    // Cart routes
    if (path === 'cart') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const cart = await db.collection('carts').findOne({ userId: user.id })
      if (!cart) {
        return NextResponse.json({ items: [], total: 0 })
      }
      
      // Populate product details
      const productIds = cart.items.map(item => item.productId)
      const products = await db.collection('products').find({ id: { $in: productIds } }).toArray()
      
      const cartItems = cart.items.map(item => {
        const product = products.find(p => p.id === item.productId)
        return {
          ...item,
          product
        }
      })
      
      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      return NextResponse.json({ items: cartItems, total })
    }

    // Orders routes
    if (path === 'orders') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      let filter = {}
      if (!isAdmin(user)) {
        filter.userId = user.id
      }
      
      const orders = await db.collection('orders')
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray()
      
      return NextResponse.json(orders)
    }

    if (path.startsWith('orders/')) {
      const orderId = path.split('/')[1]
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      let filter = { id: orderId }
      if (!isAdmin(user)) {
        filter.userId = user.id
      }
      
      const order = await db.collection('orders').findOne(filter)
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      
      return NextResponse.json(order)
    }

    // Admin routes
    if (path === 'admin/stats') {
      const user = verifyToken(request)
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      
      const totalProducts = await db.collection('products').countDocuments()
      const totalOrders = await db.collection('orders').countDocuments()
      const totalUsers = await db.collection('users').countDocuments()
      const totalRevenue = await db.collection('orders').aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]).toArray()
      
      return NextResponse.json({
        totalProducts,
        totalOrders,
        totalUsers,
        totalRevenue: totalRevenue[0]?.total || 0
      })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  } catch (error) {
    console.error('GET Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const db = await connectDB()
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/', '')
    const body = await request.json()

    // Auth routes
    if (path === 'auth/register') {
      const { email, password, name, phone, address } = body
      
      // Check if user already exists
      const existingUser = await db.collection('users').findOne({ email })
      if (existingUser) {
        return NextResponse.json({ error: 'User already exists' }, { status: 400 })
      }
      
      const hashedPassword = await bcrypt.hash(password, 10)
      const userId = uuidv4()
      
      const user = {
        id: userId,
        email,
        password: hashedPassword,
        name,
        phone: phone || '',
        address: address || '',
        role: 'customer',
        createdAt: new Date()
      }
      
      await db.collection('users').insertOne(user)
      
      const token = jwt.sign({ id: userId, email, role: 'customer' }, JWT_SECRET)
      const { password: _, ...userWithoutPassword } = user
      
      return NextResponse.json({ user: userWithoutPassword, token })
    }

    if (path === 'auth/login') {
      const { email, password } = body
      
      const user = await db.collection('users').findOne({ email })
      if (!user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET)
      const { password: _, ...userWithoutPassword } = user
      
      return NextResponse.json({ user: userWithoutPassword, token })
    }

    // Products routes (Admin only)
    if (path === 'products') {
      const user = verifyToken(request)
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      
      const { name, description, price, category, stock, images, featured } = body
      const productId = uuidv4()
      
      const product = {
        id: productId,
        name,
        description,
        price: parseFloat(price),
        category,
        stock: parseInt(stock),
        images: images || [],
        featured: featured || false,
        createdAt: new Date()
      }
      
      await db.collection('products').insertOne(product)
      return NextResponse.json(product)
    }

    // Categories routes (Admin only)
    if (path === 'categories') {
      const user = verifyToken(request)
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      
      const { name, description } = body
      const categoryId = uuidv4()
      
      const category = {
        id: categoryId,
        name,
        description: description || '',
        createdAt: new Date()
      }
      
      await db.collection('categories').insertOne(category)
      return NextResponse.json(category)
    }

    // Cart routes
    if (path === 'cart/add') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const { productId, quantity } = body
      
      // Check if product exists and has enough stock
      const product = await db.collection('products').findOne({ id: productId })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      if (product.stock < quantity) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
      }
      
      const cart = await db.collection('carts').findOne({ userId: user.id })
      
      if (cart) {
        // Update existing cart
        const existingItem = cart.items.find(item => item.productId === productId)
        
        if (existingItem) {
          existingItem.quantity += quantity
        } else {
          cart.items.push({
            productId,
            quantity,
            price: product.price,
            addedAt: new Date()
          })
        }
        
        await db.collection('carts').updateOne(
          { userId: user.id },
          { $set: { items: cart.items, updatedAt: new Date() } }
        )
      } else {
        // Create new cart
        await db.collection('carts').insertOne({
          userId: user.id,
          items: [{
            productId,
            quantity,
            price: product.price,
            addedAt: new Date()
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
      
      return NextResponse.json({ message: 'Item added to cart' })
    }

    if (path === 'cart/remove') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const { productId } = body
      
      await db.collection('carts').updateOne(
        { userId: user.id },
        { 
          $pull: { items: { productId } },
          $set: { updatedAt: new Date() }
        }
      )
      
      return NextResponse.json({ message: 'Item removed from cart' })
    }

    if (path === 'cart/update') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const { productId, quantity } = body
      
      if (quantity <= 0) {
        await db.collection('carts').updateOne(
          { userId: user.id },
          { 
            $pull: { items: { productId } },
            $set: { updatedAt: new Date() }
          }
        )
      } else {
        await db.collection('carts').updateOne(
          { userId: user.id, 'items.productId': productId },
          { 
            $set: { 
              'items.$.quantity': quantity,
              updatedAt: new Date()
            }
          }
        )
      }
      
      return NextResponse.json({ message: 'Cart updated' })
    }

    // Orders routes
    if (path === 'orders') {
      const user = verifyToken(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const { shippingAddress, items, total } = body
      const orderId = uuidv4()
      
      // Verify stock availability for all items
      for (const item of items) {
        const product = await db.collection('products').findOne({ id: item.productId })
        if (!product || product.stock < item.quantity) {
          return NextResponse.json({ 
            error: `Insufficient stock for ${product?.name || 'product'}` 
          }, { status: 400 })
        }
      }
      
      // Create order
      const order = {
        id: orderId,
        userId: user.id,
        items,
        total,
        shippingAddress,
        status: 'pending',
        paymentMethod: 'cod',
        createdAt: new Date()
      }
      
      await db.collection('orders').insertOne(order)
      
      // Update product stock
      for (const item of items) {
        await db.collection('products').updateOne(
          { id: item.productId },
          { $inc: { stock: -item.quantity } }
        )
      }
      
      // Clear user's cart
      await db.collection('carts').deleteOne({ userId: user.id })
      
      return NextResponse.json(order)
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  } catch (error) {
    console.error('POST Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const db = await connectDB()
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/', '')
    const body = await request.json()
    const user = verifyToken(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Products routes (Admin only)
    if (path.startsWith('products/')) {
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      
      const productId = path.split('/')[1]
      const { name, description, price, category, stock, images, featured } = body
      
      const updatedProduct = {
        name,
        description,
        price: parseFloat(price),
        category,
        stock: parseInt(stock),
        images: images || [],
        featured: featured || false,
        updatedAt: new Date()
      }
      
      const result = await db.collection('products').updateOne(
        { id: productId },
        { $set: updatedProduct }
      )
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      const product = await db.collection('products').findOne({ id: productId })
      return NextResponse.json(product)
    }

    // Orders routes (Admin only)
    if (path.startsWith('orders/') && path.includes('/status')) {
      if (!isAdmin(user)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      
      const orderId = path.split('/')[1]
      const { status } = body
      
      const result = await db.collection('orders').updateOne(
        { id: orderId },
        { $set: { status, updatedAt: new Date() } }
      )
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      
      const order = await db.collection('orders').findOne({ id: orderId })
      return NextResponse.json(order)
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  } catch (error) {
    console.error('PUT Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const db = await connectDB()
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/', '')
    const user = verifyToken(request)
    
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Products routes
    if (path.startsWith('products/')) {
      const productId = path.split('/')[1]
      
      const result = await db.collection('products').deleteOne({ id: productId })
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      return NextResponse.json({ message: 'Product deleted' })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  } catch (error) {
    console.error('DELETE Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}