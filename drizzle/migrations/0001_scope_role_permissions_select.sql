DROP POLICY IF EXISTS "authenticated can view role permissions" ON public.role_permissions;
CREATE POLICY "users view permissions of own roles or admin"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), role) OR public.is_admin(auth.uid()));