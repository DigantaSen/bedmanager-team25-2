// backend/TEST_ANALYTICS_ENDPOINTS.md

# Testing Analytics Endpoints

This guide helps you test the newly implemented analytics endpoints.

## Prerequisites

1. Backend running on port 5001: `npm start`
2. MongoDB connected
3. Database seeded with bed data: `node seedBeds.js`

## Test Commands

### 1. Test Occupancy Summary

```bash
curl -X GET "http://localhost:5001/api/analytics/occupancy-summary"
```

Expected: Total beds=192, with breakdown by status

---

### 2. Test Occupancy by Ward

```bash
curl -X GET "http://localhost:5001/api/analytics/occupancy-by-ward"
```

Expected: Array of 3 wards (ICU, General, Emergency) with occupancy breakdown

---

### 3. Test Bed History

First, get a valid bed ID:

```bash
curl -X GET "http://localhost:5001/api/beds" | jq '.data.beds[0]._id'
```

Then test the history endpoint:

```bash
curl -X GET "http://localhost:5001/api/analytics/bed-history/{BED_ID}?limit=10"
```

Or use bed identifier string:

```bash
curl -X GET "http://localhost:5001/api/analytics/bed-history/iA1"
```

Expected: History array (may be empty if bed hasn't had status changes yet)

---

### 4. Test Occupancy Trends

```bash
curl -X GET "http://localhost:5001/api/analytics/occupancy-trends?granularity=daily"
```

With custom date range:

```bash
curl -X GET "http://localhost:5001/api/analytics/occupancy-trends?startDate=2025-10-05&endDate=2025-11-05&granularity=daily"
```

Expected: Array of trend data points

---

### 5. Test Forecasting

```bash
curl -X GET "http://localhost:5001/api/analytics/forecasting"
```

Expected: Current metrics, expected discharges, ward forecasts

---

## Using Postman

1. Create new collection: "Bed Manager Analytics"
2. Add requests:

### Request: GET Occupancy Summary

- Method: GET
- URL: `http://localhost:5001/api/analytics/occupancy-summary`
- Params: None

### Request: GET Occupancy by Ward

- Method: GET
- URL: `http://localhost:5001/api/analytics/occupancy-by-ward`
- Params: None

### Request: GET Bed History

- Method: GET
- URL: `http://localhost:5001/api/analytics/bed-history/:bedId`
- Params:
  - `limit`: 50
  - `skip`: 0

### Request: GET Occupancy Trends

- Method: GET
- URL: `http://localhost:5001/api/analytics/occupancy-trends`
- Params:
  - `granularity`: daily
  - `startDate`: 2025-10-05
  - `endDate`: 2025-11-05

### Request: GET Forecasting

- Method: GET
- URL: `http://localhost:5001/api/analytics/forecasting`
- Params: None

---

## Expected Responses

### Successful Response Format

All successful endpoints return:

```json
{
  "success": true,
  "data": {
    // endpoint-specific data
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

---

## Common Issues

### Issue: 404 Not Found

- **Cause**: Endpoint not registered
- **Solution**: Verify analyticsRoutes.js is imported in server.js

### Issue: Empty bed history

- **Cause**: No status changes recorded for bed
- **Solution**: Manually update a bed status via `PATCH /api/beds/:id/status` first

### Issue: No trend data

- **Cause**: No occupancy logs in database
- **Solution**: Make bed status changes to generate logs

### Issue: Slow forecasting response

- **Cause**: Large dataset requiring aggregation
- **Solution**: Normal for first query, subsequent queries will be faster due to MongoDB caching

---

## Integration Test Script

```javascript
// test-analytics.js
const axios = require('axios');

const baseURL = 'http://localhost:5001/api';

async function testAnalytics() {
  try {
    console.log('Testing Analytics Endpoints...\n');

    // Test 1: Occupancy Summary
    console.log('1. Occupancy Summary');
    const summary = await axios.get(`${baseURL}/analytics/occupancy-summary`);
    console.log('✓ Success:', summary.data.data.summary);

    // Test 2: Occupancy by Ward
    console.log('\n2. Occupancy by Ward');
    const wards = await axios.get(`${baseURL}/analytics/occupancy-by-ward`);
    console.log('✓ Success: Found', wards.data.data.wardBreakdown.length, 'wards');

    // Test 3: Bed History
    console.log('\n3. Bed History');
    const beds = await axios.get(`${baseURL}/beds`);
    if (beds.data.data.beds.length > 0) {
      const bedId = beds.data.data.beds[0]._id;
      const history = await axios.get(`${baseURL}/analytics/bed-history/${bedId}?limit=10`);
      console.log('✓ Success: Found', history.data.data.history.length, 'history records');
    }

    // Test 4: Occupancy Trends
    console.log('\n4. Occupancy Trends');
    const trends = await axios.get(`${baseURL}/analytics/occupancy-trends?granularity=daily`);
    console.log('✓ Success: Found', trends.data.data.trends.length, 'trend data points');

    // Test 5: Forecasting
    console.log('\n5. Forecasting');
    const forecast = await axios.get(`${baseURL}/analytics/forecasting`);
    console.log('✓ Success: Expected discharges:', forecast.data.data.expectedDischarges);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAnalytics();
```

Run with:

```bash
node test-analytics.js
```

---

## Performance Testing

### Load Test with Apache Bench

```bash
# Test occupancy summary endpoint with 1000 requests
ab -n 1000 -c 10 http://localhost:5001/api/analytics/occupancy-summary

# Results:
# - Requests per second
# - Time per request
# - Connection times
```

### Expected Performance

- occupancy-summary: ~50-100 req/s
- occupancy-by-ward: ~30-50 req/s
- bed-history: ~20-50 req/s (depends on record count)
- occupancy-trends: ~10-30 req/s (aggregation heavy)
- forecasting: ~5-20 req/s (heavy computation)

---

## Documentation

- Full API documentation: See `ANALYTICS_API.md`
- Routes: `backend/routes/analyticsRoutes.js`
- Controller: `backend/controllers/analyticsController.js`
