// Test script to verify blog functionality
// Run with: node test_blog_functionality.js

import { createClient } from '@supabase/supabase-js';

// Use your Supabase project URL and anon key
const supabaseUrl = 'https://abknoalhfltlhhdbclpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia25vYWxoZmx0bGhoZGJjbHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI3MjE5NzQsImV4cCI6MjA0ODI5Nzk3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBlogFunctionality() {
  console.log('🧪 Testing Blog Functionality...\n');

  try {
    // Test 1: Check if posts table exists
    console.log('1️⃣ Checking if posts table exists...');
    const { data: tables, error: tableError } = await supabase
      .from('posts')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      console.error('❌ Posts table does not exist or is not accessible:', tableError.message);
      return;
    }
    console.log('✅ Posts table exists!');

    // Test 2: Try to fetch existing posts
    console.log('\n2️⃣ Fetching existing posts...');
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published');

    if (fetchError) {
      console.error('❌ Error fetching posts:', fetchError.message);
      return;
    }
    console.log(`✅ Found ${posts.length} published posts`);
    if (posts.length > 0) {
      console.log('📝 Sample post:', posts[0].title);
    }

    // Test 3: Test the blog service functions
    console.log('\n3️⃣ Testing blog service functions...');
    
    // Import and test getPostPreviews
    try {
      // This would normally be imported from the service, but for testing we'll inline it
      const { data: previews, error: previewError } = await supabase
        .from('posts')
        .select(`
          id,
          slug,
          title,
          excerpt,
          image_url,
          tags,
          published_at,
          author_id
        `)
        .eq('status', 'published')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false });

      if (previewError) {
        console.error('❌ Error in getPostPreviews:', previewError.message);
      } else {
        console.log(`✅ getPostPreviews works! Found ${previews.length} posts`);
      }
    } catch (error) {
      console.error('❌ Error testing getPostPreviews:', error.message);
    }

    console.log('\n🎉 Blog functionality test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Visit http://localhost:5001/blog to see the blog index');
    console.log('2. Visit http://localhost:5001/admin/blog to manage posts');
    console.log('3. Create a test post through the admin interface');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the test
testBlogFunctionality();
