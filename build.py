#!/usr/bin/env python3
"""Assemble Établi 3D from src/ into dist/.

  python3 build.py           -> dist/index.html     (full page, for GitHub Pages)
                                dist/artifact.html  (page body, for the claude.ai artifact)
  python3 build.py --local   -> dist/test.html      (loads three.js from node_modules, for offline tests)

The JavaScript files are concatenated in order into ONE module script: they share a single scope,
so a function defined in core.js is visible in init.js without import/export.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
JS_ORDER = ['core.js', 'prefs.js', 'scene.js', 'ui.js', 'sketch.js', 'validate.js', 'struct.js', 'examples.js', 'outliner.js', 'bubble.js', 'workspace.js', 'panels.js', 'hover.js', 'init.js']

# Pinned library versions (loaded through an import map).
THREE = '0.180.0'
BVH = '0.9.1'
CSG = '0.0.17'
CDN = {
    'three': f'https://cdn.jsdelivr.net/npm/three@{THREE}/build/three.module.js',
    'three/addons/': f'https://cdn.jsdelivr.net/npm/three@{THREE}/examples/jsm/',
    'three-mesh-bvh': f'https://cdn.jsdelivr.net/npm/three-mesh-bvh@{BVH}/build/index.module.js',
    'three-bvh-csg': f'https://cdn.jsdelivr.net/npm/three-bvh-csg@{CSG}/build/index.module.js',
}
LOCAL = {
    'three': '/node_modules/three/build/three.module.js',
    'three/addons/': '/node_modules/three/examples/jsm/',
    'three-mesh-bvh': '/node_modules/three-mesh-bvh/build/index.module.js',
    'three-bvh-csg': '/node_modules/three-bvh-csg/build/index.module.js',
}

FAVICON = ("data:image/svg+xml," +
           "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Cpath d='M16 3 28 9.5v13L16 29 4 22.5v-13z' fill='%231d7656'/%3E"
           "%3Cpath d='M4 9.5 16 16l12-6.5M16 16v13' stroke='%23fff' stroke-width='2' fill='none'/%3E%3C/svg%3E")

# What the claude.ai artifact skeleton provides; repeated here for the standalone page.
RESET = (":root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}"
         "body{margin:0}img{max-width:100%}[hidden]{display:none!important}")


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def script(imports):
    js = '\n'.join(read(n) for n in JS_ORDER)
    return ('<script type="importmap">' + json.dumps({'imports': imports}) + '</script>\n'
            '<script type="module">\n' + js + '\n</script>\n')


def full_page(imports):
    return ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="description" content="Modeleur 3D pour la technologie au collège : volumes, perçages, '
            'esquisses cotées, liaisons et simulation de mouvements, export STL.">\n'
            f'<link rel="icon" href="{FAVICON}">\n<style>{RESET}</style>\n'
            + read('head.html') + '</head>\n<body>\n' + read('body.html') + script(imports) + '</body>\n</html>\n')


def write(name, text):
    os.makedirs(DIST, exist_ok=True)
    path = os.path.join(DIST, name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{os.path.relpath(path, ROOT)}  ({len(text.encode()) // 1024} Ko)')


if __name__ == '__main__':
    if '--local' in sys.argv:
        write('test.html', full_page(LOCAL))
    else:
        write('index.html', full_page(CDN))
        write('artifact.html', read('head.html') + read('body.html') + script(CDN))
