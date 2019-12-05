const express = require('express');
const {check, body} = require('express-validator/check');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login', 
    check('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address.'),
    check('password','Please enter a password with only numbers or letters and of length 5 or greater.')
    .trim()
    .isLength({min: 5})
    .isAlphanumeric()
    ,authController.postLogin);

router.post('/signup',
    check('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address.')
    .custom((value, {req}) => {
        return User.findOne({email: value})
        .then(user => {
            if(user){
                return Promise.reject('An account with this email already exists, please choose a different one.')
            }
        })
    }),
    body(
        'password',
        'Please enter a password with only numbers or letters and of length 5 or greater.'
    )
    .trim()
    .isLength({min: 5})
    .isAlphanumeric(),
    body('confirmPassword')
    .trim()
    .custom((value, {req}) => {
        if(value !== req.body.password){
            throw new Error('Passwords must match.')
        }
        return true;
    }),
    authController.postSignup
);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;