import { traditionalToSimplified } from './src/utils/t2s.js';

const input = "Check this URL: https://abmedia.io/wp-content/uploads/2025/12/鏈新聞：732_200px3.png and some text 鏈新聞";
const expected = "Check this URL: https://abmedia.io/wp-content/uploads/2025/12/鏈新聞：732_200px3.png and some text 链新闻";

const output = traditionalToSimplified(input);
console.log("Input:   ", input);
console.log("Output:  ", output);
console.log("Expected:", expected);

if (output === expected) {
    console.log("PASS: URL preserved");
} else {
    console.log("FAIL: URL modified");
}
