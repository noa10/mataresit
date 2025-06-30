// Test authentication from browser console
(async function testAuth() {
    console.log('🔍 Testing authentication from browser...');
    
    // Get the Supabase client from the window (if available)
    const supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';
    
    // Try to get session from localStorage
    const authKey = 'sb-mpmkbtsufihzdelrlszs-auth-token';
    const authData = localStorage.getItem(authKey);
    
    if (!authData) {
        console.error('❌ No auth data found in localStorage');
        return;
    }
    
    let session;
    try {
        const parsed = JSON.parse(authData);
        session = parsed;
        console.log('✅ Found session data:', {
            hasAccessToken: !!session.access_token,
            tokenLength: session.access_token?.length,
            userEmail: session.user?.email,
            userId: session.user?.id
        });
    } catch (e) {
        console.error('❌ Failed to parse auth data:', e);
        return;
    }
    
    if (!session.access_token) {
        console.error('❌ No access token in session');
        return;
    }
    
    // Test with test-auth-validation function
    console.log('🧪 Testing with test-auth-validation function...');
    
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/test-auth-validation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({})
        });
        
        console.log('📝 Response status:', response.status);
        
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
            console.log('📊 Response data:', responseData);
        } catch (e) {
            console.log('📝 Raw response:', responseText);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
})();
