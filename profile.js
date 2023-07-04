const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema(
  {
    is_trainer: {
      type: Boolean,
      required: true,
    },
    is_demo: {
      type: Boolean,
      default: false,
    },
  },
  // additional configuration
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('profile', ProfileSchema);
