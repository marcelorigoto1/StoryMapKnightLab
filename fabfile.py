from os.path import abspath, basename, dirname, join
import sys
import shutil
from fabric.api import env
from fabric.operations import local

#
# Project-specific settings, alter as needed
#
env.project_name = basename(dirname(__file__))
env.django = False

#
# Add paths
#
def add_paths(*args):
    """Make paths are in sys.path."""
    for p in args:
        if p not in sys.path:
            sys.path.append(p)

project_path = dirname(abspath(__file__))
repos_path = dirname(project_path)

add_paths(project_path, repos_path)

#
# Import from fablib
#
from fablib import *

@task
def testui(*args,**kwargs):
    if os.path.isdir('robot_tests/logs'):
        shutil.rmtree('robot_tests/logs')
    os.execvp('robot', ('robot', '-d', 'robot_tests/logs') + args + ('robot_tests',))

@task(alias='testint')
def testntegration(*args, **kwargs):
    local('python -m tests.integration_tests')

@task
def unittest(*args, **kwargs):
    local('python -m tests.unit_tests')

@task
def prd(*args,**kwargs):
    abort( "you should be deploying with git, not the prd task")

@task
def stg(*args,**kwargs):
    abort( "you should be deploying with git, not the stg task")
