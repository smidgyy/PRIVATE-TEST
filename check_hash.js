
const crypto = require('crypto');

function hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const target = '90b7b8654171c04a5e5de1eae884cfd86952739d50d09d9bb7680763e31faee8';

const words = ['greed', 'money', 'crown', 'gold', 'nigredo', 'albedo', 'rubedo', 'citrinitas', 'philosopher', 'stone', 'mercury', 'sulfur', 'salt'];

words.forEach(w => {
  if (hash(w) === target) {
    console.log(`MATCH FOUND: ${w}`);
  }
});
