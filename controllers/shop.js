const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalProducts;

  Product.find()
  .countDocuments()
  .then( numProducts => {
    totalProducts = numProducts
    return Product.find()
      .skip((page -1) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
  })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalProducts,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalProducts/ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalProducts;

  Product.find()
  .countDocuments()
  .then(numProducts => {
    totalProducts = numProducts;
    return Product.find()
    .skip((page-1) * ITEMS_PER_PAGE)
    .limit(ITEMS_PER_PAGE)
  })
  .then(products => {
    res.render('shop/index', {
      prods: products,
      pageTitle: 'Shop',
      path: '/',
      currentPage:page,
      hasNextPage: page * ITEMS_PER_PAGE < totalProducts,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page -1,
      lastPage: Math.ceil(totalProducts/ITEMS_PER_PAGE)
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
  .then(product => {
    return req.user.addToCart(product)
  })
  .then(result => {
    console.log(result)
    res.redirect('/cart');
  })
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user.deleteItemFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(item => {
        return {quantity: item.quantity, product: {...item.productId._doc}}
      })
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      })
      return order.save()
    })
    .then(result => {
      return req.user.clearCart()
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({'user.userId': req.user._id})
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  const invoiceName = 'invoice-' + orderId + '.pdf';
  const invoicePath = path.join('data', 'invoices', invoiceName);
  Order.findById(orderId)
  .then(order => {
    if(!order){
      return next(new Error('No order found.'))
    }
    if(order.user.userId.toString() !== req.user._id.toString()){
      return next(new Error('Unauthorized access.'))
    }
    const pdfDoc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    //res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');

    pdfDoc.pipe(fs.createWriteStream(invoicePath));
    pdfDoc.pipe(res);
    
   

    pdfDoc.fontSize(26).text('Invoice', {
      underline: true
    });
    let totalPrice = 0;
    order.products.forEach(product => {
      totalPrice += product.product.price * product.quantity;
      pdfDoc.fontSize(16).text(`${product.product.title} - ${product.quantity} x $ ${product.product.price}`);
    })
    pdfDoc.text('              ');
    pdfDoc.text(`Total Price: $ ${totalPrice}`);
    pdfDoc.end();


  })
  .catch(err => next(err))
}

exports.getCheckout = (req, res, next) => {
  let products;
  let totalSum = 0;
  req.user
  .populate('cart.items.productId')
  .execPopulate()
  .then(user => {
    products = user.cart.items
    products.forEach(p => {
      totalSum += p.quantity * p.productId.price;
    })
    return stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: products.map(product => {
        return {
          name: product.productId.title,
          description: product.productId.description,
          amount: product.productId.price * 100,
          currency: 'usd',
          quantity: product.quantity
        }
      }),
      // success_url: 'http://localhost:3000/checkout/success',
      // cancel_url: 'http://localhost:3000/checkout/cancel'
      success_url: req.protocol + '://' + req.get('host') + '/checkout/success',
      cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
    })
  })
    .then(session => {
      console.log('session',session)
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum: totalSum,
        sessionId: session.id
      });
    })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
}

exports.getCheckoutSuccess = (req, res, next) => {
  let totalSum = 0;
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      user.cart.items.forEach(p => {
        totalSum += p.quantity * p.productId.price;
      });
 
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(() => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      console.log(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}

exports.postReview = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
  .then(product => {
    res.render('shop/write-review', {
      product: product,
      pageTitle: product.title,
      path: '/products'
    })

  })
  .catch(err => {
    const error = new Error(err);
    error.httpsStatusCode = 500;
    return next(error)
  })

}

exports.postProcessReview = (req, res, next) => {
  const prodId = req.body.productId;

  const rating = req.body.rating;
  const headline = req.body.headline;
  const review = req.body.review;

  Product.findById(prodId)
  .then(product => {
    if(product.totalReviews === 0){
      console.log('here')
      product.avgRating = rating;  
    }else{
      const avg = (product.avgRating * product.totalReviews + +rating) / (product.totalReviews + 1);
      product.avgRating = Math.round(avg * 10) / 10;
    }
    product.totalReviews++;
    product.stars[rating-1].amount++;
    product.reviews.push({rating, title:headline, review})
    return product.save()
  })
  .then(product => {
    res.render('shop/product-detail', {
      product: product,
      pageTitle: product.title,
      path: '/products'
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpsStatusCode = 500;
    return next(error)
  })


}