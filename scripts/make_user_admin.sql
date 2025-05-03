
-- Replace 'YOUR_EMAIL_HERE' with the email of the user you want to make an admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.users.id AND role = 'admin'
);

-- Alternatively, you can use a specific user ID:
-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('YOUR_USER_ID_HERE', 'admin')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- To verify the change:
SELECT * FROM public.user_roles;
