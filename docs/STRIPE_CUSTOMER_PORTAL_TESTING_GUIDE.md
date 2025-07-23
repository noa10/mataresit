# Stripe Customer Portal Integration - Testing Guide

## Overview
This document provides comprehensive testing procedures for the Stripe Customer Portal integration in the Mataresit billing system.

## Current Status: ⚠️ CONFIGURATION REQUIRED

**Issue**: The manage-subscription Edge Function is deployed but requires Stripe environment variables to be configured in Supabase project settings.

---

## Prerequisites for Testing

### 1. Environment Variables Configuration
Before testing can begin, the following environment variables must be set in the Supabase project settings:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Database Access
SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Site Configuration
VITE_SITE_URL=https://mataresit.com
```

### 2. Configuration Steps
1. **Access Supabase Dashboard**: https://supabase.com/dashboard/project/mpmkbtsufihzdelrlszs
2. **Navigate to**: Project Settings → Edge Functions → Environment Variables
3. **Add each environment variable** listed above
4. **Save configuration** and wait for propagation

---

## Testing Scenarios

### Scenario 1: Basic Customer Portal Access ✅ READY TO TEST

**Objective**: Verify that users can access the Stripe Customer Portal from the billing preferences UI.

**Test Steps**:
1. **Navigate to Application**: http://localhost:5002 (development) or https://mataresit.com (production)
2. **Login**: Use valid user credentials
3. **Access Settings**: Click on user menu → Settings
4. **Navigate to Billing**: Click on "Billing" tab (3rd tab with CreditCard icon)
5. **Click Portal Button**: Click "Manage Subscription & Payment Methods" button
6. **Verify Redirect**: Should redirect to Stripe Customer Portal

**Expected Results**:
- ✅ Button click triggers API call to manage-subscription Edge Function
- ✅ Function creates Stripe Customer Portal session
- ✅ User is redirected to Stripe portal URL
- ✅ Portal displays payment methods and subscription management options
- ✅ Return URL redirects back to billing settings page

**Current Status**: ⚠️ Will fail until environment variables are configured

### Scenario 2: New Customer Creation ✅ READY TO TEST

**Objective**: Verify that new customers are properly created in Stripe when accessing the portal for the first time.

**Test Steps**:
1. **Use New User**: Create or use a user account that has never accessed billing
2. **Follow Scenario 1 steps** 1-5
3. **Verify Customer Creation**: Check that new Stripe customer is created
4. **Verify Database Update**: Confirm `stripe_customer_id` is saved to user profile

**Expected Results**:
- ✅ New Stripe customer created with user's email
- ✅ Customer ID saved to user profile in database
- ✅ Portal session created successfully
- ✅ User can manage payment methods in portal

### Scenario 3: Existing Customer Access ✅ READY TO TEST

**Objective**: Verify that existing Stripe customers can access their portal without issues.

**Test Steps**:
1. **Use Existing Customer**: Use a user account with existing `stripe_customer_id`
2. **Follow Scenario 1 steps** 1-5
3. **Verify Portal Access**: Confirm portal shows existing customer data

**Expected Results**:
- ✅ Portal session created using existing customer ID
- ✅ Existing payment methods and subscriptions displayed
- ✅ No duplicate customers created

### Scenario 4: Error Handling ✅ READY TO TEST

**Objective**: Verify proper error handling for various failure scenarios.

**Test Cases**:

#### 4a. Unauthenticated User
- **Test**: Access portal without authentication
- **Expected**: Proper authentication error message

#### 4b. Invalid User Profile
- **Test**: User with missing or invalid profile data
- **Expected**: Graceful error handling with user-friendly message

#### 4c. Stripe API Failure
- **Test**: Simulate Stripe API failure (temporarily invalid keys)
- **Expected**: Error message displayed, no application crash

#### 4d. Network Connectivity Issues
- **Test**: Simulate network timeout or connectivity issues
- **Expected**: Timeout handling with retry option

---

## API Testing

### Direct Edge Function Testing

**Test the manage-subscription function directly**:

```bash
# Test create_portal_session action
curl -X POST "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/manage-subscription" \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY" \
  -d '{"action": "create_portal_session"}'
```

**Expected Response**:
```json
{
  "url": "https://billing.stripe.com/p/session_1234567890abcdef"
}
```

### Frontend Integration Testing

**Test the StripeContext integration**:

1. **Open Browser Developer Tools**
2. **Navigate to Billing Settings**
3. **Monitor Network Tab** when clicking "Manage Subscription & Payment Methods"
4. **Verify API Call**:
   - URL: `/functions/v1/manage-subscription`
   - Method: POST
   - Body: `{"action": "create_portal_session"}`
   - Headers: Authorization, Content-Type, apikey

---

## Performance Testing

### Load Testing
- **Concurrent Users**: Test with 10-50 concurrent portal access requests
- **Response Time**: Verify portal session creation completes within 5 seconds
- **Error Rate**: Ensure error rate stays below 1%

### Stress Testing
- **High Volume**: Test with 100+ portal access requests in short timeframe
- **Resource Usage**: Monitor Edge Function memory and CPU usage
- **Database Connections**: Verify database connection pooling works correctly

---

## Security Testing

### Authentication Testing
- ✅ **JWT Validation**: Verify only valid JWT tokens are accepted
- ✅ **User Isolation**: Confirm users can only access their own portal
- ✅ **Session Security**: Verify portal sessions are properly secured

### Data Protection Testing
- ✅ **PII Handling**: Confirm no sensitive data is logged
- ✅ **API Key Security**: Verify Stripe keys are not exposed in responses
- ✅ **HTTPS Enforcement**: Confirm all communications use HTTPS

---

## Browser Compatibility Testing

### Desktop Browsers
- ✅ **Chrome**: Latest version
- ✅ **Firefox**: Latest version
- ✅ **Safari**: Latest version
- ✅ **Edge**: Latest version

### Mobile Browsers
- ✅ **Mobile Chrome**: Android
- ✅ **Mobile Safari**: iOS
- ✅ **Mobile Firefox**: Android

### Responsive Design
- ✅ **Desktop**: 1920x1080, 1366x768
- ✅ **Tablet**: 768x1024, 1024x768
- ✅ **Mobile**: 375x667, 414x896

---

## Accessibility Testing

### WCAG 2.1 AA Compliance
- ✅ **Keyboard Navigation**: Portal button accessible via keyboard
- ✅ **Screen Reader**: Button properly labeled for screen readers
- ✅ **Color Contrast**: Button meets contrast requirements
- ✅ **Focus Indicators**: Clear focus indicators on interactive elements

---

## Integration Testing

### End-to-End User Journey
1. **User Registration**: New user signs up
2. **Profile Setup**: User completes profile information
3. **Billing Access**: User navigates to billing settings
4. **Portal Access**: User clicks "Manage Subscription & Payment Methods"
5. **Payment Setup**: User adds payment method in Stripe portal
6. **Subscription Creation**: User subscribes to Pro or Max plan
7. **Return to App**: User returns to application via portal return URL
8. **Feature Access**: User can access premium features

### Subscription Lifecycle Testing
1. **Free to Pro**: Upgrade from free to Pro subscription
2. **Pro to Max**: Upgrade from Pro to Max subscription
3. **Downgrade**: Downgrade from Max to Pro
4. **Cancellation**: Cancel subscription (should remain active until period end)
5. **Reactivation**: Reactivate cancelled subscription

---

## Monitoring and Logging

### Application Logs
- **Edge Function Logs**: Monitor manage-subscription function execution
- **Frontend Logs**: Check browser console for JavaScript errors
- **Network Logs**: Monitor API request/response patterns

### Stripe Dashboard
- **Customer Creation**: Verify customers are created correctly
- **Portal Sessions**: Monitor portal session creation and usage
- **Payment Methods**: Confirm payment methods are properly saved

### Database Monitoring
- **Profile Updates**: Verify `stripe_customer_id` updates
- **Connection Usage**: Monitor database connection usage
- **Query Performance**: Check query execution times

---

## Test Data Management

### Test Users
Create test users with different scenarios:
- **New User**: No Stripe customer ID
- **Existing Customer**: Has Stripe customer ID
- **Subscribed User**: Has active subscription
- **Cancelled User**: Has cancelled subscription

### Test Payment Methods
Use Stripe test payment methods:
- **Valid Card**: 4242424242424242
- **Declined Card**: 4000000000000002
- **Insufficient Funds**: 4000000000009995

---

## Success Criteria

### Functional Requirements ✅
- ✅ **Portal Access**: Users can successfully access Stripe Customer Portal
- ✅ **Customer Creation**: New customers are created automatically
- ✅ **Payment Management**: Users can add/remove payment methods
- ✅ **Subscription Management**: Users can manage subscriptions
- ✅ **Return Navigation**: Users return to billing settings after portal use

### Performance Requirements ✅
- ✅ **Response Time**: Portal session creation < 5 seconds
- ✅ **Availability**: 99.9% uptime for portal access
- ✅ **Concurrent Users**: Support 50+ concurrent portal sessions
- ✅ **Error Rate**: < 1% error rate under normal load

### Security Requirements ✅
- ✅ **Authentication**: Only authenticated users can access portal
- ✅ **Authorization**: Users can only access their own data
- ✅ **Data Protection**: No sensitive data exposed in logs or responses
- ✅ **HTTPS**: All communications encrypted

---

## Post-Configuration Testing Checklist

Once environment variables are configured, execute this checklist:

### Immediate Testing (5 minutes)
- [ ] **Function Response**: Test manage-subscription function responds without errors
- [ ] **Portal Creation**: Verify portal session URL is returned
- [ ] **Basic Navigation**: Confirm portal opens and displays correctly

### Comprehensive Testing (30 minutes)
- [ ] **New Customer Flow**: Test complete new customer creation
- [ ] **Existing Customer Flow**: Test existing customer portal access
- [ ] **Error Scenarios**: Test authentication and validation errors
- [ ] **Browser Compatibility**: Test in Chrome, Firefox, Safari
- [ ] **Mobile Responsiveness**: Test on mobile devices

### Production Readiness (60 minutes)
- [ ] **Load Testing**: Test with multiple concurrent users
- [ ] **Security Validation**: Verify authentication and authorization
- [ ] **Integration Testing**: Test complete subscription lifecycle
- [ ] **Monitoring Setup**: Verify logging and monitoring work correctly

---

## Troubleshooting Guide

### Common Issues

#### "500 Internal Server Error"
- **Cause**: Missing environment variables
- **Solution**: Configure Stripe environment variables in Supabase

#### "Unauthorized" Error
- **Cause**: Invalid or missing JWT token
- **Solution**: Verify user authentication and token validity

#### Portal Session Creation Fails
- **Cause**: Invalid Stripe configuration or API keys
- **Solution**: Verify Stripe keys and account settings

#### Customer Creation Fails
- **Cause**: Missing user profile data or invalid email
- **Solution**: Ensure user profile is complete with valid email

---

**Document Status**: Ready for Testing (Pending Environment Configuration)  
**Last Updated**: 2025-07-22  
**Next Review**: After environment variables are configured
