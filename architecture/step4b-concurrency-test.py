# Disposable database only; deterministic barrier via psql output.
import os, subprocess
assert os.environ['PGHOST']=='127.0.0.1' and os.environ['PGDATABASE']=='aurea_fixture'
cmd=['psql','-X','-qAt','-v','ON_ERROR_STOP=1']
def query(s):
    return subprocess.check_output(cmd+['-c',s],text=True).strip()
def race(first,second):
    with subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1) as p:
        p.stdin.write("BEGIN;\n"+first+";\n\\echo LOCK_HELD\n")
        p.stdin.flush()
        while True:
            line=p.stdout.readline()
            if not line: raise RuntimeError('first transaction failed')
            if line.strip()=='LOCK_HELD': break
        q=subprocess.Popen(cmd+['-c',second],stdout=subprocess.PIPE,text=True)
        p.stdin.write('COMMIT;\n\\q\n');p.stdin.flush()
        result=q.communicate(timeout=15)[0].strip()
        assert q.returncode==0 and p.wait(timeout=15)==0
        return result
a='00000000-0000-0000-0000-000000000007'
b='00000000-0000-0000-0000-000000000008'
def submit(c):
    return f"SELECT aurea_private.qa_submit_locked('{c}',md5('{c}late')::uuid,4::smallint)"
def close(c):
    return f"UPDATE aurea_private.cycles SET state='closed' WHERE id='{c}'"
race(submit(a),close(a))
assert query(f"SELECT response_count||':'||favorable_percent FROM aurea_private.privacy_publications_v1 WHERE cycle_id='{a}'")=='5:60.0'
assert race(close(b),submit(b))=='f'
assert query(f"SELECT count(*) FROM aurea_private.responses WHERE cycle_id='{b}'")=='4'
assert query(f"SELECT count(*) FROM aurea_private.privacy_publications_v1 WHERE cycle_id='{b}'")=='0'
print('PASS submit-first included; close-first denied; empty seal retained (synthetic lock contract)')
