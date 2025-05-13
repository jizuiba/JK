#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建工具 - 用于构建LOL信息查询工具的Python和Electron应用
"""

import os
import sys
import shutil
import subprocess
import platform
import argparse
import glob
import logging
from typing import Optional, List, Dict, Tuple, Union

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger("builder")

# 路径常量
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(ROOT_DIR, 'web')
BUILD_DIR = os.path.join(ROOT_DIR, 'dist_python')
PYTHON_FILES = ['main.py']

# 系统常量
SYSTEM = platform.system().lower()
IS_WIN = SYSTEM == 'windows'
IS_MAC = SYSTEM == 'darwin'
IS_LINUX = SYSTEM == 'linux'

# NVM相关路径配置
DEFAULT_NVM_PATHS = [
    r'E:\softwares\nvm\v19.8.0',  # 用户指定的NVM路径
]

# Windows NVM可能的安装位置
WINDOWS_NVM_LOCATIONS = [
    # 常见的驱动器
    drive + path for drive in ['C:', 'D:', 'E:', 'F:'] for path in [
        '\\nvm',
        '\\softwares\\nvm', 
        '\\software\\nvm',
        '\\programs\\nvm',
        '\\program files\\nvm',
        '\\tools\\nvm'
    ]
]

class Builder:
    """构建工具主类"""
    
    def __init__(self, args):
        """初始化构建工具
        
        Args:
            args: 命令行参数对象
        """
        self.args = args
        self.npm_path = None
        self.node_path = None
        self._setup_paths()
    
    def _setup_paths(self) -> None:
        """设置npm和node路径"""
        # 从命令行参数设置路径
        if self.args.npm_path and os.path.exists(self.args.npm_path):
            npm_dir = os.path.dirname(self.args.npm_path)
            self.npm_path = self.args.npm_path
            logger.info(f"使用指定的npm路径: {self.args.npm_path}")
            
            # 通过npm路径推断node路径
            node_cmd = os.path.join(npm_dir, 'node.exe' if IS_WIN else 'node')
            if os.path.exists(node_cmd):
                self.node_path = node_cmd
        
        if self.args.node_path and os.path.exists(self.args.node_path):
            node_dir = os.path.dirname(self.args.node_path)
            self.node_path = self.args.node_path
            logger.info(f"使用指定的node路径: {self.args.node_path}")
            
            # 如果npm路径还未设置，通过node路径推断
            if not self.npm_path:
                npm_cmd = os.path.join(node_dir, 'npm.cmd' if IS_WIN else 'npm')
                if os.path.exists(npm_cmd):
                    self.npm_path = npm_cmd
        
        # 将路径添加到环境变量
        if self.npm_path or self.node_path:
            path_dir = os.path.dirname(self.npm_path or self.node_path)
            os.environ['PATH'] = path_dir + os.pathsep + os.environ.get('PATH', '')
            logger.info(f"已临时将 {path_dir} 添加到PATH环境变量")
    
    def run(self) -> int:
        """运行构建流程
        
        Returns:
            int: 返回状态码，0表示成功，非0表示失败
        """
        logger.info("开始构建应用...")
        
        # 根据命令行参数决定构建流程
        if self.args.electron_only:
            return self._build_electron_only()
        elif self.args.python_only:
            return self._build_python_only()
        else:
            return self._build_full()
    
    def _build_electron_only(self) -> int:
        """只构建Electron部分
        
        Returns:
            int: 返回状态码，0表示成功，非0表示失败
        """
        # 检查Python构建结果是否存在
        if not os.path.exists(BUILD_DIR) or not os.path.exists(os.path.join(BUILD_DIR, 'main.exe')):
            logger.warning("没有找到Python构建结果，Electron应用需要依赖Python部分")
            logger.warning("建议先完成Python部分构建")
            user_input = input("是否继续只构建Electron部分? (y/n): ")
            if user_input.lower() != 'y':
                return 1
        
        # 构建Electron应用
        electron_success = self._build_electron_app()
        if electron_success:
            logger.info("Electron应用构建成功！")
            return 0
        else:
            logger.error("Electron应用构建失败。")
            return 1
    
    def _build_python_only(self) -> int:
        """只构建Python部分
        
        Returns:
            int: 返回状态码，0表示成功，非0表示失败
        """
        try:
            # 清理构建目录
            self._clean_build_dir()
            
            # 复制文件
            self._copy_files()
            
            # 构建Python可执行文件
            self._build_python_executable()
            
            logger.info("Python应用构建成功！")
            logger.info(f"可执行文件位于: {os.path.join(BUILD_DIR, 'main.exe')}")
            return 0
        except Exception as e:
            logger.error(f"Python应用构建失败: {e}")
            return 1
    
    def _build_full(self) -> int:
        """构建完整应用
        
        Returns:
            int: 返回状态码，0表示成功，非0表示失败
        """
        try:
            # 清理构建目录
            self._clean_build_dir()
            
            # 复制文件
            self._copy_files()
            
            # 构建Python可执行文件
            self._build_python_executable()
            
            # 构建Electron应用
            electron_success = self._build_electron_app()
            
            if electron_success:
                logger.info("构建完成！应用已成功打包。")
                return 0
            else:
                logger.warning("Python部分构建成功，但Electron应用构建失败。")
                logger.info("您可以在dist_python目录中找到Python可执行文件。")
                logger.info("如需完成Electron应用构建，请解决上述错误后重试。")
                logger.info("您可以使用 --electron-only 参数只构建Electron部分: python build.py --electron-only")
                if not self.args.npm_path:
                    logger.info("或者使用 --npm-path 参数指定npm路径: python build.py --electron-only --npm-path E:\\softwares\\nvm\\v19.8.0\\npm.cmd")
                return 1
        except Exception as e:
            logger.error(f"构建失败: {e}")
            return 1
    
    def _clean_build_dir(self) -> None:
        """清理构建目录"""
        logger.info("清理构建目录...")
        if os.path.exists(BUILD_DIR):
            shutil.rmtree(BUILD_DIR)
        os.makedirs(BUILD_DIR)
    
    def _copy_files(self) -> None:
        """复制必要的文件到构建目录"""
        logger.info("复制文件到构建目录...")
        
        # 复制Python文件
        for file in PYTHON_FILES:
            shutil.copy2(os.path.join(ROOT_DIR, file), BUILD_DIR)
    
    def _build_python_executable(self) -> None:
        """使用PyInstaller打包Python应用"""
        logger.info("使用PyInstaller打包Python应用...")
        
        # 确保PyInstaller已安装
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)
        except subprocess.CalledProcessError:
            logger.error("PyInstaller安装失败，请手动安装: pip install pyinstaller")
            raise RuntimeError("PyInstaller安装失败")
        
        # 构建命令
        cmd = [
            sys.executable, '-m', 'PyInstaller',
            '--name=main',
            '--onefile',
            '--clean',
            '--distpath=' + os.path.join(BUILD_DIR),
            '--workpath=' + os.path.join(BUILD_DIR, 'build'),
            '--specpath=' + os.path.join(BUILD_DIR),
        ]
        
        # 添加web目录
        web_data_path = os.path.join(WEB_DIR)
        if os.path.exists(web_data_path):
            path_sep = ';' if IS_WIN else ':'
            cmd.append('--add-data=' + web_data_path + path_sep + 'web')
            logger.info(f"添加web目录: {web_data_path}")
            
            # 确保web目录存在
            if not os.path.exists(web_data_path):
                logger.warning(f"web目录不存在: {web_data_path}")
                # 尝试创建web目录
                os.makedirs(web_data_path, exist_ok=True)
        
        # 添加依赖项
        cmd.extend([
            '--hidden-import=pkg_resources.py2_warn',
            '--hidden-import=flask',
            '--hidden-import=flask_cors',
            '--hidden-import=requests',
            '--hidden-import=psutil',
            '--hidden-import=urllib3',
            '--hidden-import=werkzeug',
        ])
        
        # 主脚本
        cmd.append(os.path.join(ROOT_DIR, 'main.py'))
        
        # 输出完整命令便于调试
        logger.info(f"构建命令: {' '.join(cmd)}")
        
        # 执行构建命令
        try:
            subprocess.run(cmd, check=True)
            
            # 构建完成后，确保可执行文件存在
            exe_path = os.path.join(BUILD_DIR, 'main.exe' if IS_WIN else 'main')
            if os.path.exists(exe_path):
                logger.info(f"构建成功，可执行文件在: {exe_path}")
            else:
                logger.error(f"构建完成，但找不到可执行文件: {exe_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"构建失败: {e}")
            raise RuntimeError("PyInstaller构建失败")
    
    def _build_electron_app(self) -> bool:
        """构建Electron应用
        
        Returns:
            bool: 是否构建成功
        """
        logger.info("构建Electron应用...")
        
        # 检查node和npm是否安装
        if not self._check_nodejs_npm():
            return False
        
        # 获取npm路径（如果通过命令行参数已设置，则使用已设置的）
        npm_path = self.npm_path or self._find_npm() or 'npm'
        
        # 设置Node.js环境变量
        self._setup_node_env(npm_path)
        
        # 确保需要的npm包已安装
        try:
            logger.info("正在安装npm依赖...")
            subprocess.run([npm_path, 'install'], check=True)
        except subprocess.CalledProcessError as e:
            logger.error(f"npm包安装失败: {e}")
            logger.error("请确保已安装Node.js和npm，并且有网络连接")
            return False
        
        # 构建electron应用
        try:
            logger.info("正在构建Electron应用...")
            subprocess.run([npm_path, 'run', 'build'], check=True)
            logger.info("Electron应用构建成功！")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Electron构建失败: {e}")
            return False
    
    def _check_nodejs_npm(self) -> bool:
        """检查Node.js和npm是否已安装
        
        Returns:
            bool: 是否安装了Node.js和npm
        """
        logger.info("检查Node.js和npm...")
        
        # 如果已经设置了node和npm路径，直接验证
        if self.node_path and os.path.exists(self.node_path):
            try:
                result = subprocess.run([self.node_path, '--version'], 
                                      check=True, capture_output=True, text=True)
                logger.info(f"Node.js版本: {result.stdout.strip()}")
            except subprocess.CalledProcessError as e:
                logger.error(f"指定的Node.js路径无效: {e}")
                return False
        else:
            # 检查node.js
            try:
                node_version = subprocess.run(['node', '--version'], 
                                            check=True, capture_output=True, text=True)
                logger.info(f"Node.js版本: {node_version.stdout.strip()}")
            except FileNotFoundError:
                logger.error("未找到Node.js。请确保已安装Node.js，并且它在系统PATH中。")
                logger.error("您可以从 https://nodejs.org 下载并安装Node.js（包含npm）。")
                return False
            except subprocess.CalledProcessError as e:
                logger.error(f"检查Node.js版本时出错: {e}")
                return False
        
        # 检查npm
        if self.npm_path and os.path.exists(self.npm_path):
            try:
                npm_version = subprocess.run([self.npm_path, '--version'], 
                                           check=True, capture_output=True, text=True)
                logger.info(f"npm版本: {npm_version.stdout.strip()}")
                return True
            except subprocess.CalledProcessError as e:
                logger.error(f"指定的npm路径无效: {e}")
                return False
        else:
            npm_path = self._find_npm()
            if npm_path:
                try:
                    npm_version = subprocess.run([npm_path, '--version'], 
                                               check=True, capture_output=True, text=True)
                    logger.info(f"npm版本: {npm_version.stdout.strip()}")
                    return True
                except subprocess.CalledProcessError as e:
                    logger.error(f"检查npm版本时出错: {e}")
                    return False
            else:
                logger.error("未找到npm。即使安装了Node.js，npm可能未正确安装或不在PATH中。")
                logger.error("您可以尝试重新安装Node.js或手动添加npm到系统PATH。")
                logger.error("详见README.md中的构建指南。")
                return False
    
    def _find_npm(self) -> Optional[str]:
        """查找npm的路径
        
        Returns:
            Optional[str]: npm的路径，如果找不到则返回None
        """
        # 首先尝试直接执行npm，看是否在PATH中
        try:
            result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, text=True, check=True)
            return 'npm'  # npm在PATH中，直接返回命令名
        except (FileNotFoundError, subprocess.CalledProcessError):
            logger.info("npm不在系统PATH中，尝试在常见的安装位置查找...")
        
        # 检查用户指定的NVM路径
        for path in DEFAULT_NVM_PATHS:
            npm_path = self._check_npm_in_dir(path)
            if npm_path:
                logger.info(f"在自定义NVM路径找到npm: {npm_path}")
                return npm_path
        
        # 在Windows上查找npm的常见位置
        if IS_WIN:
            # 程序文件目录中的Node.js
            program_files = [
                os.environ.get('ProgramFiles', 'C:\\Program Files'),
                os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)')
            ]
            
            # 检查程序文件目录
            for pf in program_files:
                for pattern in ['nodejs*', 'Node.js*']:
                    for node_dir in glob.glob(os.path.join(pf, pattern)):
                        npm_path = self._check_npm_in_dir(node_dir)
                        if npm_path:
                            return npm_path
            
            # 用户目录中的nvm安装
            appdata = os.environ.get('APPDATA', '')
            if appdata:
                for nvm_dir in glob.glob(os.path.join(appdata, 'nvm', 'v*')):
                    npm_path = self._check_npm_in_dir(nvm_dir)
                    if npm_path:
                        return npm_path
            
            # 检查其他可能的NVM安装位置
            for nvm_base in WINDOWS_NVM_LOCATIONS:
                if os.path.exists(nvm_base):
                    # 查找所有版本目录
                    for version_dir in glob.glob(os.path.join(nvm_base, 'v*')):
                        npm_path = self._check_npm_in_dir(version_dir)
                        if npm_path:
                            return npm_path
        
        # 在Mac/Linux上查找npm的常见位置
        else:
            potential_paths = [
                '/usr/local/bin/npm',
                '/usr/bin/npm',
                os.path.expanduser('~/.nvm/versions/node/*/bin/npm')
            ]
            
            for path_pattern in potential_paths:
                for npm_path in glob.glob(path_pattern):
                    if os.path.exists(npm_path) and os.access(npm_path, os.X_OK):
                        logger.info(f"在 {npm_path} 找到npm")
                        return npm_path
        
        # 没有找到npm
        return None
    
    def _check_npm_in_dir(self, directory: str) -> Optional[str]:
        """检查指定目录中是否存在npm
        
        Args:
            directory: 要检查的目录
            
        Returns:
            Optional[str]: npm的路径，如果不存在则返回None
        """
        if not os.path.exists(directory):
            return None
            
        npm_cmd_path = os.path.join(directory, 'npm.cmd')
        npm_exe_path = os.path.join(directory, 'npm.exe')
        npm_bin_path = os.path.join(directory, 'bin', 'npm')
        
        if os.path.exists(npm_cmd_path):
            return npm_cmd_path
        elif os.path.exists(npm_exe_path):
            return npm_exe_path
        elif os.path.exists(npm_bin_path) and os.access(npm_bin_path, os.X_OK):
            return npm_bin_path
            
        return None
    
    def _setup_node_env(self, npm_path: str) -> None:
        """设置Node.js环境变量
        
        Args:
            npm_path: npm的路径
        """
        if not npm_path or npm_path == 'npm':
            return  # 使用系统npm，无需设置环境变量
        
        # 获取npm所在的目录
        npm_dir = os.path.dirname(npm_path)
        
        # 设置临时环境变量，确保node可以正常运行
        os.environ['PATH'] = npm_dir + os.pathsep + os.environ.get('PATH', '')
        logger.info(f"已临时将 {npm_dir} 添加到PATH环境变量")
        
        # 检查node是否可访问
        try:
            node_path = os.path.join(npm_dir, 'node.exe' if IS_WIN else 'node')
            if not os.path.exists(node_path):
                node_path = os.path.join(npm_dir, 'node')
            
            result = subprocess.run([node_path, '--version'], 
                                  capture_output=True, text=True, check=True)
            logger.info(f"已找到Node.js: {result.stdout.strip()}")
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            logger.warning(f"无法验证Node.js: {e}")


def parse_args() -> argparse.Namespace:
    """解析命令行参数
    
    Returns:
        argparse.Namespace: 解析后的参数对象
    """
    parser = argparse.ArgumentParser(description='构建Python和Electron应用')
    parser.add_argument('--python-only', action='store_true', 
                       help='只构建Python应用')
    parser.add_argument('--electron-only', action='store_true', 
                       help='只构建Electron应用')
    parser.add_argument('--npm-path', 
                       help='指定npm可执行文件的路径，例如: E:\\softwares\\nvm\\v19.8.0\\npm.cmd')
    parser.add_argument('--node-path', 
                       help='指定node可执行文件的路径，例如: E:\\softwares\\nvm\\v19.8.0\\node.exe')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='显示详细日志信息')
    return parser.parse_args()


def main() -> int:
    """主函数
    
    Returns:
        int: 程序退出状态码，0表示成功，非0表示失败
    """
    args = parse_args()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 创建构建器并运行
    builder = Builder(args)
    return builder.run()


if __name__ == "__main__":
    sys.exit(main())