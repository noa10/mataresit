# Profile Page Testing Guide

## Overview
This guide provides step-by-step instructions for testing the comprehensive profile page functionality in the Mataresit application.

## Prerequisites
- Development server running (`npm run dev`)
- Supabase local instance running
- Test user account (preferably with Google OAuth)

## Test Scenarios

### 1. Profile Page Access
**Objective**: Verify profile page loads correctly for authenticated users

**Steps**:
1. Navigate to `/auth` and sign in with any method
2. Navigate to `/profile` or click Profile in the navigation
3. Verify the profile page loads with all tabs visible

**Expected Results**:
- Profile page displays with 5 tabs: Profile, Billing, Teams, Settings, Security
- User avatar/initials display correctly in the sidebar
- No console errors

### 2. Avatar Upload Functionality
**Objective**: Test custom avatar upload and management

**Steps**:
1. Go to Profile tab
2. Hover over the avatar area - should see camera icon overlay
3. Click on avatar or "Upload Photo" button
4. Select a valid image file (JPEG, PNG, or WebP under 5MB)
5. Wait for upload to complete
6. Verify avatar updates in both profile page and navbar

**Expected Results**:
- File upload works without errors
- Avatar displays immediately after upload
- Navbar avatar updates to show new image
- Success toast notification appears

**Test Cases**:
- Valid image formats (JPEG, PNG, WebP)
- Invalid file types (should show error)
- Files over 5MB (should show error)
- Very small images (should work)
- Very large images (should be optimized)

### 3. Avatar Removal
**Objective**: Test removing custom avatar

**Steps**:
1. Upload a custom avatar (if not already done)
2. Click "Remove" button
3. Confirm removal
4. Verify avatar reverts to Google avatar or initials

**Expected Results**:
- Custom avatar is removed
- Falls back to Google avatar if available
- Falls back to initials if no Google avatar
- Success toast notification appears

### 4. Profile Information Editing
**Objective**: Test profile information updates

**Steps**:
1. Go to Profile tab
2. Click "Edit" button on Personal Information card
3. Update first name, last name, and/or email
4. Click "Save Changes"
5. Verify information updates correctly

**Expected Results**:
- Form validation works (email format, length limits)
- Changes save successfully
- UI updates immediately
- Success toast notification appears

**Test Cases**:
- Valid name updates
- Invalid email format (should show error)
- Names over 50 characters (should show error)
- Empty fields (should be allowed)

### 5. Google OAuth Avatar Integration
**Objective**: Test automatic Google avatar capture

**Steps**:
1. Sign out if currently signed in
2. Sign in using Google OAuth
3. Check if Google profile picture is automatically set
4. Navigate to profile page
5. Verify Google avatar displays correctly

**Expected Results**:
- Google profile picture is automatically captured during OAuth
- Avatar displays in profile page and navbar
- No custom avatar upload needed for new Google users

### 6. Subscription Information Display
**Objective**: Test subscription and billing information

**Steps**:
1. Go to Billing tab
2. Verify current plan displays correctly
3. Check usage statistics (receipts used this month)
4. Verify plan features are listed
5. Test "Manage Plan" link

**Expected Results**:
- Current subscription tier displays with correct badge
- Usage statistics show accurate numbers
- Progress bar shows correct percentage (if not unlimited)
- Plan features list correctly
- "Manage Plan" link navigates to pricing page

### 7. Team Memberships Display
**Objective**: Test team membership information

**Steps**:
1. Go to Teams tab
2. Verify team memberships display (if any)
3. Check role badges and team status
4. Test "Manage Teams" link

**Expected Results**:
- Team memberships display correctly
- Role badges show appropriate colors and icons
- Team status (active/inactive) displays correctly
- "Manage Teams" link navigates to teams page
- Empty state shows if no team memberships

### 8. Settings and Preferences
**Objective**: Test appearance settings

**Steps**:
1. Go to Settings tab
2. Toggle dark mode switch
3. Verify theme changes immediately
4. Refresh page and verify theme persists

**Expected Results**:
- Dark mode toggle works immediately
- Theme preference persists across page refreshes
- Success toast notification appears

### 9. Security Settings
**Objective**: Test security and account management

**Steps**:
1. Go to Security tab
2. For non-Google users: Test "Change Password" button
3. For Google users: Verify Google security link
4. Test "Sign Out Everywhere" button
5. Test account deletion dialog (DO NOT COMPLETE)

**Expected Results**:
- Password change dialog opens (non-Google users)
- Google security link opens in new tab (Google users)
- Sign out functionality works
- Account deletion dialog shows proper warnings
- All security features work as expected

### 10. Mobile Responsiveness
**Objective**: Test profile page on mobile devices

**Steps**:
1. Open browser developer tools
2. Switch to mobile viewport (iPhone, Android)
3. Navigate through all profile tabs
4. Test avatar upload on mobile
5. Test form interactions

**Expected Results**:
- All tabs display correctly on mobile
- Touch interactions work smoothly
- Forms are easy to use on mobile
- Avatar upload works on mobile devices
- No horizontal scrolling issues

### 11. Navigation Integration
**Objective**: Test profile integration with navigation

**Steps**:
1. Check main navigation sidebar for Profile link
2. Click Profile link from sidebar
3. Check navbar user menu for Profile link
4. Verify avatar displays in navbar
5. Test mobile navigation profile access

**Expected Results**:
- Profile link appears in main navigation
- Profile link works from navbar dropdown
- User avatar displays in navbar (custom or Google)
- Mobile navigation includes profile access

## Error Scenarios to Test

### Network Errors
- Test avatar upload with poor network connection
- Test profile updates with network interruption
- Verify proper error handling and retry options

### Permission Errors
- Test accessing profile page without authentication
- Verify proper redirects to login page

### File Upload Errors
- Test uploading files that are too large
- Test uploading invalid file types
- Test uploading corrupted image files

## Performance Testing

### Load Times
- Measure profile page initial load time
- Test avatar upload speed with various file sizes
- Verify smooth animations and transitions

### Memory Usage
- Check for memory leaks during avatar uploads
- Monitor performance during tab switching

## Browser Compatibility

### Test Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Features to Test
- Avatar upload functionality
- Image preview and optimization
- Form validation
- Theme switching
- Responsive design

## Accessibility Testing

### Screen Reader Support
- Test profile page with screen reader
- Verify proper ARIA labels on interactive elements
- Test keyboard navigation through all tabs

### Keyboard Navigation
- Test tab navigation through profile forms
- Verify all interactive elements are keyboard accessible
- Test escape key functionality in dialogs

## Security Testing

### Data Validation
- Test SQL injection attempts in form fields
- Verify file upload security (no executable files)
- Test XSS prevention in profile fields

### Authentication
- Verify profile data is user-specific
- Test session timeout handling
- Verify proper logout functionality

## Reporting Issues

When reporting issues, please include:
1. Browser and version
2. Device type (desktop/mobile)
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (if any)
6. Screenshots or screen recordings

## Success Criteria

The profile page implementation is considered successful when:
- All test scenarios pass without errors
- Performance meets acceptable standards
- Mobile experience is smooth and intuitive
- Security measures are properly implemented
- Accessibility requirements are met
- Integration with existing features works seamlessly
