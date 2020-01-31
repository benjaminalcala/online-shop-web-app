const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const aws = require('aws-sdk');
const multerS3 = require('multer-s3');

const errorController = require('./controllers/error');
const User = require('./models/user');

const MONGO_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-amusn.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`

aws.config.update({
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  accessKeyId:process.env.AMAZON_ACCESS_KEY_ID,
  region: 'us-west-1'
})

//was this updated?

const s3 = new aws.S3();

const app = express();
const store = new MongoDBStore({
  uri: MONGO_URI,
  collection: 'connections'
})
const csrfProtection = csrf();

// const fileStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'images');
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// })

const fileFilter = (req, file, cb) => {
  if(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg'){
    cb(null, true)
  } else {
    cb(null, false)
  }
}

app.set('view engine', 'ejs');
app.set('views', 'views');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'acccess.log'), {flags: 'a'});

app.use(helmet());
app.use(compression());
app.use(morgan('combined', {stream: accessLogStream}))

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({
  storage: multerS3({
    s3: s3,
    bucket: 'ben-online-shop-images',
    acl:'public-read',
    metadata: (req, file, cb) => {
      cb(null, {fieldName: file.fieldname});
    },
    contentDisposition: 'attachment',
    key: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname)
    }
  }), fileFilter: fileFilter}).single('image'));

  //might need to delete file filter

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(session({
  secret: 'my secret',
  resave: false,
  saveUninitialized: false,
  store: store
}))
app.use(csrfProtection);
app.use(flash())

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
})

app.use((req, res, next) => {
  if(!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
  .then(user => {
    if(!user){
      return next();
    }
    req.user = user;
    next();
  })
  .catch(err => {
    next(new Error(err));
  });
})



app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get('/500', errorController.get500)

app.use(errorController.get404);

app.use((err, req, res, next) => {
  console.log(err);
  res.status(500)
  .render('500', { 
    pageTitle: 'Error', 
    path: '/500',
    isAuthenticated: req.session.isLoggedIn });
})

mongoose
  .connect(MONGO_URI)
  .then(result => {
    app.listen(process.env.PORT || 3000)
  })
  .catch(err => {
    console.log(err)
  })



