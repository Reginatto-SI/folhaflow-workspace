"""PostgreSQL descartável, sem portas/rede ou acesso ao banco da aplicação.
Executar na raiz: python supabase/tests/test_g2_commission.py
Requer Docker e postgres:17-alpine (download prévio se necessário).
"""
import json
import os
from pathlib import Path
import subprocess
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / 'supabase/migrations'
MIGRATION = (MIGRATIONS / '20261105173000_add_commission_to_g2_complemento.sql').read_text()
CONTAINER = 'folhaflow-g2-test-' + uuid.uuid4().hex[:10]
ENV = {k: v for k, v in os.environ.items() if k not in (
    'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')}


def docker(*args, **kwargs):
    return subprocess.run(['docker', '--host=unix:///var/run/docker.sock', *args],
                          env=ENV, text=True, capture_output=True, **kwargs)


def sql(query, fail=False):
    result = docker('exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-XAt',
                    '-v', 'ON_ERROR_STOP=1', input=query)
    if fail:
        if result.returncode == 0:
            raise AssertionError('SQL deveria ter abortado')
        return result.stderr
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def rubric(code, derived=False):
    return sql(f"""insert into public.rubricas
        (code,name,category,type,entry_mode,nature,calculation_method,classification)
        values ('{code}','Nome sem semântica','teste','provento',
        '{'formula' if derived else 'manual'}','{'calculada' if derived else 'base'}',
        '{'formula' if derived else 'manual'}',{'NULL' if derived else "'outros_rendimentos'"}) returning id;""").splitlines()[0]


def snapshot():
    return sql("""select jsonb_build_object(
      'rubricas', (select jsonb_agg(to_jsonb(r) order by id) from public.rubricas r),
      'items', (select jsonb_agg(to_jsonb(i) order by id) from public.rubrica_formula_items i),
      'policies', (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public')
    );""")


class MigrationTests(unittest.TestCase):
    def setUp(self):
        sql('drop schema public cascade; create schema public;')
        sql('create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;')
        sql('create function public.has_permission(uuid,text) returns boolean language sql as $$ select false $$;')
        sql((MIGRATIONS / '20260405001000_create_rubricas_module.sql').read_text())
        sql((MIGRATIONS / '20260418183949_4e3aa22b-85f5-46cc-a5f2-f3db7efbddc8.sql').read_text())
        sql((MIGRATIONS / '20260418193942_62913b72-2911-4f11-be6f-6c5fb594ac50.sql').read_text())
        self.g2 = rubric('g2_complemento', True)
        self.commission = rubric('18')
        self.fiscal = rubric('salario_fiscal')
        self.net = rubric('salario_liquido', True)
        sql(f"""insert into public.rubrica_formula_items(rubrica_id,source_rubrica_id,operation,item_order) values
          ('{self.g2}','{self.fiscal}','subtract',7), ('{self.net}','{self.commission}','add',2);""")

    def test_append_and_repeat_preserve_every_existing_row_and_policy(self):
        before = json.loads(snapshot())
        sql(MIGRATION)
        after = json.loads(snapshot())
        self.assertEqual(before['rubricas'], after['rubricas'])
        self.assertEqual(before['policies'], after['policies'])
        for row in before['items']:
            self.assertIn(row, after['items'])
        added = [r for r in after['items'] if r not in before['items']]
        self.assertEqual(len(added), 1)
        self.assertEqual([added[0][k] for k in ('rubrica_id','source_rubrica_id','operation','item_order')],
                         [self.g2,self.commission,'add',8])
        sql(MIGRATION)
        self.assertEqual(json.loads(snapshot()), after)

    def test_legacy_code_and_independent_order_and_name(self):
        sql(f"update public.rubricas set code='SALARIO_G2_COMPLEMENTO',display_order=55 where id='{self.g2}';")
        sql(MIGRATION)
        self.assertEqual(sql(f"select count(*) from public.rubrica_formula_items where rubrica_id='{self.g2}';"), '2')

    def assert_abort_without_changes(self, message):
        before = snapshot()
        self.assertIn(message, sql(MIGRATION, fail=True))
        self.assertEqual(snapshot(), before)

    def test_missing_commission(self):
        sql(f"delete from public.rubrica_formula_items where rubrica_id='{self.net}'; delete from public.rubricas where id='{self.commission}';")
        self.assert_abort_without_changes('Comissão: esperado um único code técnico 18; encontrados 0')

    def test_ambiguous_commission(self):
        rubric(' 18 ')
        self.assert_abort_without_changes('Comissão: esperado um único code técnico 18; encontrados 2')

    def test_inactive_commission(self):
        sql(f"update public.rubricas set is_active=false where id='{self.commission}';")
        self.assert_abort_without_changes('Comissão (18): rubrica deve estar ativa')

    def test_wrong_commission_type(self):
        sql(f"update public.rubricas set type='desconto' where id='{self.commission}';")
        self.assert_abort_without_changes('Comissão (18): rubrica deve estar ativa')

    def test_ambiguous_g2(self):
        rubric('salario_g2_complemento', True)
        self.assert_abort_without_changes('G2: esperado um único code')

    def test_missing_g2(self):
        sql(f"delete from public.rubricas where id='{self.g2}';")
        self.assert_abort_without_changes('G2: esperado um único code')

    def test_inactive_g2(self):
        sql(f"update public.rubricas set is_active=false where id='{self.g2}';")
        self.assert_abort_without_changes('G2: rubrica deve estar ativa')

    def test_empty_formula(self):
        sql(f"delete from public.rubrica_formula_items where rubrica_id='{self.g2}';")
        self.assert_abort_without_changes('G2: fórmula existente vazia')

    def test_conflicting_existing_commission_reference(self):
        sql(f"insert into public.rubrica_formula_items(rubrica_id,source_rubrica_id,operation,item_order) values ('{self.g2}','{self.commission}','subtract',9);")
        self.assert_abort_without_changes('operação ou multiplicidade inesperada')

    def test_duplicate_existing_additions(self):
        sql(f"insert into public.rubrica_formula_items(rubrica_id,source_rubrica_id,operation,item_order) values ('{self.g2}','{self.commission}','add',9), ('{self.g2}','{self.commission}','add',10);")
        self.assert_abort_without_changes('operação ou multiplicidade inesperada')


if __name__ == '__main__':
    try:
        result = docker('run','--rm','-d','--network=none','--name',CONTAINER,
                        '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine')
        if result.returncode:
            raise RuntimeError(result.stderr)
        for _ in range(60):
            if docker('exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres').returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('PostgreSQL não ficou pronto')
        sql('create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;')
        unittest.main()
    finally:
        docker('rm','-f',CONTAINER)
