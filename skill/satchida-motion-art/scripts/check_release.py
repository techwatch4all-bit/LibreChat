#!/usr/bin/env python3
"""Incremental release check: scans what Git actually has staged for release and verifies the final
file manifest; never pushes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

MANIFEST='release-manifest.json'
SECRET=re.compile(rb'/Users/[A-Za-z0-9_.-]+/|/home/[A-Za-z0-9_.-]+/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{30,}|ghp_[A-Za-z0-9]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}')


def git(repo,*args):
    return subprocess.check_output(['git','--no-replace-objects','-C',str(repo),*args])


def tree(repo,ref):
    files={}
    command=['ls-files','--stage','-z'] if ref=='INDEX' else ['ls-tree','-r','-z',ref]
    for row in git(repo,*command).split(b'\0'):
        if not row:continue
        meta,name=row.split(b'\t',1);parts=meta.decode().split();name=name.decode()
        mode,oid=parts[0],parts[1] if ref=='INDEX' else parts[2]
        if SECRET.search(name.encode()):raise ValueError('file path contains a sensitive shape; identifier: '+hashlib.sha256(name.encode()).hexdigest()[:12])
        if mode not in ('100644','100755'):raise ValueError('symlinks, submodules or conflicted files are not released: '+name)
        if ref=='INDEX' and parts[2]!='0':raise ValueError('index contains a merge conflict')
        files[name]={'mode':mode,'oid':oid}
    return files


def forbidden(name):
    p=Path(name)
    if any(x in p.parts for x in ('_private','_archive','.huashu','__pycache__','node_modules','.venv')):return True
    if p.name in ('voices.json','media.local.json'):return True
    if p.name.startswith('.env') and p.name!='.env.example':return True
    if p.name=='media.json' and name!='defaults/media.json':return True
    return p.suffix in ('.pem','.key','.p12','.pfx','.wav','.mov','.mp4','.pyc','.log')


def inspect(repo,ref):
    hashes={}
    for name,entry in tree(repo,ref).items():
        if SECRET.search(name.encode()):raise ValueError('file path contains a sensitive shape; identifier: '+hashlib.sha256(name.encode()).hexdigest()[:12])
        if forbidden(name):raise ValueError('private configuration or process artifact included: '+name)
        data=git(repo,'cat-file','blob',entry['oid'])
        if SECRET.search(data):raise ValueError('private paths or credential shapes found: '+name)
        if name!=MANIFEST:hashes[name]=hashlib.sha256(data).hexdigest()
    return hashes


def build_manifest(repo):
    if git(repo,'diff','--name-only').strip():raise ValueError('unstaged modifications exist; review and stage them before generating the manifest')
    return {'schema_version':1,'files':inspect(repo,'INDEX')}


def check(repo,ref,base=None,email=None):
    if git(repo,'rev-parse','--is-shallow-repository').strip()==b'true':
        raise ValueError('a shallow clone cannot prove the complete outgoing history; fetch full history first')
    graft=Path(git(repo,'rev-parse','--git-path','info/grafts').decode().strip())
    if not graft.is_absolute():graft=repo/graft
    if graft.exists() and graft.stat().st_size:
        raise ValueError('graft-based history rewriting exists; cannot serve as a release basis')
    if ref!='INDEX' and git(repo,'cat-file','-t',ref).strip()!=b'commit':
        raise ValueError('this gate only handles commit refs; tag objects need separate review')
    expected=inspect(repo,ref)
    spec=':'+MANIFEST if ref=='INDEX' else ref+':'+MANIFEST
    try:manifest=json.loads(git(repo,'show',spec))
    except (ValueError,subprocess.CalledProcessError):raise ValueError('missing a valid release manifest') from None
    if manifest!={'schema_version':1,'files':expected}:raise ValueError('reviewed manifest does not match the Git file tree; regenerate and re-review')
    commits=[]
    if ref!='INDEX':
        revision=base+'..'+ref if base and set(base)!={'0'} else ref
        commits=git(repo,'rev-list',revision).decode().splitlines()
        # Scan every outgoing commit so secrets committed-then-deleted are not missed by a HEAD-only check.
        for commit in commits:
            raw=git(repo,'cat-file','commit',commit)
            if SECRET.search(raw):raise ValueError('commit metadata/message contains private paths or credential shapes: '+commit[:12])
            inspect(repo,commit)
            if email:
                identities=git(repo,'show','-s','--format=%ae%n%ce',commit).decode().splitlines()
                if any(x!=email for x in identities):raise ValueError('outgoing commit author email does not match configuration: '+commit[:12])
    return {'status':'passed','ref':ref,'files':len(expected),'outgoing_commits_checked':len(commits)}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['manifest','check'])
    p.add_argument('--repo',type=Path,required=True);p.add_argument('--ref',default='HEAD');p.add_argument('--base');p.add_argument('--author-email');p.add_argument('--pre-push',action='store_true')
    a=p.parse_args();repo=a.repo.resolve()
    if not (repo/'.git').exists():raise ValueError('the Git repository root must be given explicitly; no implicit scanning of parent repos')
    if a.command=='manifest':
        (repo/MANIFEST).write_text(json.dumps(build_manifest(repo),ensure_ascii=False,indent=2)+'\n')
        print('Release manifest generated; stage it after review, then run check --ref INDEX.')
        return
    if a.pre_push:
        if git(repo,'status','--porcelain','--untracked-files=all').strip():raise ValueError('the working tree must be clean before push')
        lines=sys.stdin.read().splitlines()
        if not lines:raise ValueError('pre-push provided no real outgoing refs')
        for line in lines:
            local_ref,local_sha,remote_ref,remote_sha=line.split()
            if SECRET.search((local_ref+' '+remote_ref).encode()):raise ValueError('outgoing ref name contains a sensitive shape')
            if set(local_sha)=={'0'}:raise ValueError('this check does not authorize deleting remote refs')
            print(json.dumps(check(repo,local_sha,remote_sha,a.author_email),ensure_ascii=False))
    else:print(json.dumps(check(repo,a.ref,a.base,a.author_email),ensure_ascii=False))


if __name__=='__main__':
    try:main()
    except (ValueError,OSError,subprocess.CalledProcessError) as e:
        print('Release check failed: '+(str(e) if isinstance(e,ValueError) else type(e).__name__),file=sys.stderr);raise SystemExit(1)
