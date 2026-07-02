const mongoose = require('mongoose');

const subscriptionPreEnrollmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model(
  'SubscriptionPreEnrollment',
  subscriptionPreEnrollmentSchema
);