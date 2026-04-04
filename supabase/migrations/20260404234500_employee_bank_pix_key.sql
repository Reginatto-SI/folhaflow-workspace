-- Campo opcional de chave Pix no cadastro bancário de funcionários.
alter table public.employees
  add column if not exists bank_pix_key text;

comment on column public.employees.bank_pix_key is
  'Chave Pix opcional para recebimento (CPF, e-mail, telefone ou EVP).';

-- Mantém a normalização defensiva já aplicada aos demais campos textuais do funcionário.
create or replace function public.normalize_employee_fields()
returns trigger
language plpgsql
as $$
begin
  new.cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  new.name := regexp_replace(trim(new.name), '\s+', ' ', 'g');
  new.registration := nullif(regexp_replace(trim(coalesce(new.registration, '')), '\s+', ' ', 'g'), '');
  new.notes := nullif(regexp_replace(trim(coalesce(new.notes, '')), '\s+', ' ', 'g'), '');
  new.department := nullif(regexp_replace(trim(coalesce(new.department, '')), '\s+', ' ', 'g'), '');
  new.role := nullif(regexp_replace(trim(coalesce(new.role, '')), '\s+', ' ', 'g'), '');
  new.bank_name := nullif(regexp_replace(trim(coalesce(new.bank_name, '')), '\s+', ' ', 'g'), '');
  new.bank_branch := nullif(regexp_replace(trim(coalesce(new.bank_branch, '')), '\s+', ' ', 'g'), '');
  new.bank_account := nullif(regexp_replace(trim(coalesce(new.bank_account, '')), '\s+', ' ', 'g'), '');
  new.bank_pix_key := nullif(regexp_replace(trim(coalesce(new.bank_pix_key, '')), '\s+', ' ', 'g'), '');

  return new;
end;
$$;
