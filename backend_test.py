#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import time

class DomeCityAPITester:
    def __init__(self, base_url="https://permission-checker-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.failures = []

    def log_result(self, test_name, success, response_data=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
            if response_data:
                print(f"   Response: {json.dumps(response_data, indent=2)}")
        else:
            self.failures.append({
                "test": test_name,
                "error": error,
                "response": response_data
            })
            print(f"❌ {test_name}: FAILED")
            if error:
                print(f"   Error: {error}")
            if response_data:
                print(f"   Response: {json.dumps(response_data, indent=2)}")

    def test_api_endpoint(self, name, method, endpoint, expected_status=200, data=None):
        """Test a single API endpoint"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = None
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            if not success:
                error = f"Expected status {expected_status}, got {response.status_code}"
            else:
                error = None

            self.log_result(name, success, response_data, error)
            return success, response_data

        except requests.exceptions.RequestException as e:
            self.log_result(name, False, None, str(e))
            return False, {}
        except Exception as e:
            self.log_result(name, False, None, str(e))
            return False, {}

    def test_health_check(self):
        """Test backend health check endpoint"""
        return self.test_api_endpoint("API Health Check", "GET", "/")

    def test_status_endpoint(self):
        """Test Arduino status endpoint"""
        return self.test_api_endpoint("Arduino Status", "GET", "/status")

    def test_history_endpoint(self):
        """Test temperature history endpoint"""
        return self.test_api_endpoint("Temperature History", "GET", "/history")

    def test_ports_endpoint(self):
        """Test serial ports endpoint"""
        return self.test_api_endpoint("Serial Ports", "GET", "/ports")

    def test_mode_endpoints(self):
        """Test mode control endpoints"""
        results = []
        
        # Test Emergency Mode
        success, data = self.test_api_endpoint(
            "Emergency Mode", "POST", "/mode/emergency", 
            expected_status=503  # Arduino not connected, expect 503
        )
        results.append(success)
        
        # Test Comfort Mode  
        success, data = self.test_api_endpoint(
            "Comfort Mode", "POST", "/mode/comfort",
            expected_status=503  # Arduino not connected, expect 503
        )
        results.append(success)
        
        # Test Idle Mode
        success, data = self.test_api_endpoint(
            "Idle Mode", "POST", "/mode/idle",
            expected_status=503  # Arduino not connected, expect 503
        )
        results.append(success)
        
        return all(results)

    def test_target_temperature(self):
        """Test target temperature setting"""
        test_data = {"temperature": 22.5}
        return self.test_api_endpoint(
            "Set Target Temperature", "POST", "/target", 
            expected_status=503,  # Arduino not connected, expect 503
            data=test_data
        )

    def test_events_endpoint(self):
        """Test events endpoint"""
        return self.test_api_endpoint("Arduino Events", "GET", "/events")

    def validate_arduino_data_structure(self, data):
        """Validate the structure of Arduino data response"""
        required_fields = [
            'temp', 'humidity', 'target', 'mode', 'fan', 'heater', 
            'leds', 'error', 'waiting', 'connected', 'last_update'
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            return False, f"Missing required fields: {missing_fields}"
        
        # Validate LED structure
        if 'leds' in data and isinstance(data['leds'], dict):
            led_colors = ['red', 'yellow', 'green', 'blue']
            for color in led_colors:
                if color not in data['leds']:
                    missing_fields.append(f"leds.{color}")
        
        if missing_fields:
            return False, f"Missing LED fields: {missing_fields}"
            
        return True, "Arduino data structure is valid"

    def run_all_tests(self):
        """Run comprehensive backend API test suite"""
        print("=" * 60)
        print("🚀 DOME CITY TEMPERATURE CONTROL - BACKEND API TESTS")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Test 1: API Health Check
        success, health_data = self.test_health_check()
        
        # Test 2: Arduino Status 
        success, status_data = self.test_status_endpoint()
        if success and status_data:
            # Validate Arduino data structure
            is_valid, message = self.validate_arduino_data_structure(status_data)
            self.log_result("Arduino Data Structure Validation", is_valid, None, None if is_valid else message)
            
            # Check expected disconnected state
            if not status_data.get('connected', True):
                self.log_result("Arduino Connection State (Expected Disconnected)", True, 
                              {"connected": False, "reason": "COM4 not available in test environment"})
            else:
                self.log_result("Arduino Connection State Check", False, 
                              None, "Expected Arduino to be disconnected in test environment")

        # Test 3: Temperature History
        self.test_history_endpoint()
        
        # Test 4: Serial Ports
        self.test_ports_endpoint()
        
        # Test 5: Mode Control Endpoints
        self.test_mode_endpoints()
        
        # Test 6: Target Temperature
        self.test_target_temperature()
        
        # Test 7: Events Endpoint
        self.test_events_endpoint()

        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failures)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failures:
            print("\n❌ FAILED TESTS:")
            for failure in self.failures:
                print(f"  • {failure['test']}: {failure['error']}")
        else:
            print("\n🎉 All tests passed!")
            
        print(f"\nTest Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return len(self.failures) == 0


def main():
    """Main test execution"""
    tester = DomeCityAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())