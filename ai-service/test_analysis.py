import unittest
import numpy as np
import cv2
from main import get_blur_score, get_brightness

class TestSaarthiCVCore(unittest.TestCase):
    def test_blur_detection(self):
        # Create a sharp image (black canvas with white circle)
        img_sharp = np.zeros((500, 500), dtype=np.uint8)
        cv2.circle(img_sharp, (250, 250), 100, 255, -1)
        blur_sharp = get_blur_score(img_sharp)
        
        # Create a blurry version
        img_blurry = cv2.GaussianBlur(img_sharp, (21, 21), 0)
        blur_blurry = get_blur_score(img_blurry)
        
        print(f"Sharp Blur Score: {blur_sharp:.2f}, Blurry Blur Score: {blur_blurry:.2f}")
        self.assertTrue(blur_sharp > blur_blurry)

    def test_brightness_detection(self):
        # Create a dark image
        img_dark = np.ones((100, 100), dtype=np.uint8) * 20
        b_dark = get_brightness(img_dark)
        
        # Create a bright image
        img_bright = np.ones((100, 100), dtype=np.uint8) * 220
        b_bright = get_brightness(img_bright)
        
        print(f"Dark Brightness: {b_dark:.2f}, Bright Brightness: {b_bright:.2f}")
        self.assertEqual(b_dark, 20.0)
        self.assertEqual(b_bright, 220.0)

if __name__ == "__main__":
    unittest.main()
