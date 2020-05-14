const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        required:true
    },
    totalReviews: {
        type: Number,
        required: true
    },
    stars: [
      {
          rating: {
              type: Number,
              required: true
          },
          amount: {
              type: Number,
              required: true
          }
      }
    ],
    avgRating: {
        type: Number,
        required: true
    },
    reviews: [
        {
            rating: {
                type: Number,
                required: true
            },
            title: {
                type: String,
                required: true
            },
            review: {
                type: String,
                required: true
            }
        }
    ]

})

module.exports = mongoose.model('Review', reviewSchema)