import argparse
import json
import logging
import os
import re
import sys
import threading
import webbrowser

import psutil
import requests
import urllib3
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# 禁用不安全的HTTPS警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', encoding='UTF-8')

# 确定资源文件路径（处理PyInstaller打包情况）
def resource_path(relative_path):
    """ 获取资源的绝对路径，兼容开发环境和PyInstaller打包环境 """
    try:
        # PyInstaller创建临时文件夹，将路径存储在_MEIPASS中
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    return os.path.join(base_path, relative_path)

# 创建Flask应用
app = Flask(__name__, static_folder=resource_path('web'), static_url_path='')
CORS(app)  # 启用CORS

# LCU API 连接相关
lcu_port = None
lcu_token = ''

# 检查是否在Electron环境中运行
IS_ELECTRON = 'ELECTRON_RUN_AS_NODE' in os.environ or os.environ.get('ELECTRON', '') == 'true'
logging.info(f"是否在Electron环境中运行: {IS_ELECTRON}")

# 全局变量
current_summoner = None
lcu_connection = {
    "auth_key": None,
    "process_id": None,
    "port": None,
    "url": None,
    "session": None,
    "connected": False
}

# 主页路由
@app.route('/')
def index():
    return send_from_directory(resource_path('web'), 'index.html')

# 检查LCU连接API
@app.route('/api/check_lcu_connection', methods=['GET'])
def check_lcu_connection():
    global lcu_port, lcu_token
    
    try:
        logging.info("开始检查英雄联盟客户端连接...")

        processes = list(psutil.process_iter(['pid', 'name', 'cmdline']))
        league_processes = [p for p in processes if p.info['name'] and 'League' in p.info['name']]

        for proc in league_processes:
            if proc.info['cmdline']:
                cmdline = ' '.join(proc.info['cmdline'])

                # 查找端口和令牌
                app_port_match = re.search(r'--app-port=(\d+)', cmdline)
                auth_token_match = re.search(r'--remoting-auth-token=([a-zA-Z0-9_-]+)', cmdline)

                if app_port_match and auth_token_match:
                    lcu_port = app_port_match.group(1)
                    lcu_token = auth_token_match.group(1)
                    logging.info(f"成功从进程找到端口:{lcu_port} 和令牌")
                    break
                else:
                    lcu_port = None
                    lcu_token = None
        
        if lcu_port and lcu_token:
            return jsonify({"status": "connected", "port": lcu_port, "token": lcu_token, "message": "连接成功"})
        else:
            return jsonify({"status": "disconnected", "message": "英雄联盟客户端连接失败 "})
    
    except Exception as e:
        return jsonify({"status": "error", "message": f"检查连接时出错: {str(e)}"})

# 获取当前登录用户信息
@app.route('/api/get_current_summoner', methods=['GET'])
def get_current_summoner():
    connection_status = check_lcu_connection()
    response_data = json.loads(connection_status.get_data(as_text=True))
    if response_data["status"] != "connected":
        return jsonify({"status": "error", "message": "未连接到英雄联盟客户端"})
    
    try:
        url = f"https://127.0.0.1:{lcu_port}/lol-summoner/v1/current-summoner"
        response = requests.get(
            url,
            verify=False,
            auth=('riot', lcu_token)
        )
        
        if response.status_code == 200:
            return jsonify({"status": "success", "data": response.json()})
        else:
            return jsonify({
                "status": "error", 
                "message": f"API请求失败，状态码: {response.status_code}",
                "details": response.text
            })
    
    except Exception as e:
        return jsonify({"status": "error", "message": f"获取用户信息时出错: {str(e)}"})

# 根据puuid获取玩家信息
@app.route('/api/get_summoner_by_puuid', methods=['GET'])
def get_summoner_by_puuid():
    puuid = request.args.get('puuid')
    
    if not puuid:
        return jsonify({"status": "error", "message": "缺少puuid参数"})
    
    connection_status = check_lcu_connection()
    response_data = json.loads(connection_status.get_data(as_text=True))
    if response_data["status"] != "connected":
        return jsonify({"status": "error", "message": "未连接到英雄联盟客户端"})
    
    try:
        # 尝试通过puuid获取用户信息
        url = f"https://127.0.0.1:{lcu_port}/lol-summoner/v2/summoners/puuid/{puuid}"
        
        response = requests.get(
            url,
            verify=False,
            auth=('riot', lcu_token)
        )
        
        if response.status_code == 200:
            logging.info(f"成功获取玩家信息，PUUID: {puuid}")
            return jsonify({"status": "success", "data": response.json()})
        else:
            logging.error(f"获取玩家信息失败，状态码: {response.status_code}")
            return jsonify({
                "status": "error", 
                "message": f"获取玩家信息失败，状态码: {response.status_code}",
                "details": response.text
            })
    
    except Exception as e:
        logging.error(f"获取玩家信息时出错: {str(e)}")
        return jsonify({"status": "error", "message": f"获取玩家信息时出错: {str(e)}"})

# 获取玩家战绩
@app.route('/api/get_match_history', methods=['GET'])
def get_match_history():
    puuid = request.args.get('puuid')
    begin_index = request.args.get('begin_index', 0, type=int)
    end_index = request.args.get('end_index', 6, type=int)
    
    connection_status = check_lcu_connection()
    response_data = json.loads(connection_status.get_data(as_text=True))
    if response_data["status"] != "connected":
        return jsonify({"status": "error", "message": "未连接到英雄联盟客户端"})

    try:
        url = f"https://127.0.0.1:{lcu_port}/lol-match-history/v1/products/lol/{puuid}/matches"
        params = {
            "begIndex": begin_index,
            "endIndex": end_index
        }
        
        response = requests.get(
            url,
            params=params,
            verify=False,
            auth=('riot', lcu_token)
        )
        
        if response.status_code == 200:
            logging.info(f"成功获取玩家战绩，PUUID: {puuid}")
            return jsonify({"status": "success", "data": response.json(), "source": "api"})
        else:
            logging.info(f"API请求失败，状态码: {response.status_code}")
            return jsonify({"status": "error", "data": None, "message": f"API请求失败，状态码: {response.status_code}"})
    
    except Exception as e:
        logging.error(f"获取战绩时出错: {str(e)}")
        return jsonify({"status": "error", "data": None, "message": f"获取战绩时出错啦"})

# 获取对局详情
@app.route('/api/get_match_detail', methods=['GET'])
def get_match_detail():
    match_id = request.args.get('match_id')
    
    if not match_id:
        return jsonify({"status": "error", "message": "缺少match_id参数"})
    
    connection_status = check_lcu_connection()
    response_data = json.loads(connection_status.get_data(as_text=True))
    if response_data["status"] != "connected":
        return jsonify({"status": "error", "message": "未连接到英雄联盟客户端"})

    try:
        # 使用LCU API获取对局详情
        url = f"https://127.0.0.1:{lcu_port}/lol-match-history/v1/games/{match_id}"
        
        response = requests.get(
            url,
            verify=False,
            auth=('riot', lcu_token)
        )
        
        if response.status_code == 200:
            logging.info(f"成功获取对局{match_id}的详情")
            return jsonify({"status": "success", "data": response.json()})
        else:
            logging.error(f"获取对局详情失败，状态码: {response.status_code}")
            # 尝试使用备用API
            try:
                # 备用方法：通过match timeline API获取
                url_alt = f"https://127.0.0.1:{lcu_port}/lol-match-history/v1/match-details/{match_id}"
                response_alt = requests.get(
                    url_alt,
                    verify=False,
                    auth=('riot', lcu_token)
                )
                
                if response_alt.status_code == 200:
                    logging.info(f"通过备用API成功获取对局{match_id}的详情")
                    return jsonify({"status": "success", "data": response_alt.json()})
                else:
                    return jsonify({
                        "status": "error", 
                        "message": f"获取对局详情失败，状态码: {response.status_code}, 备用API状态码: {response_alt.status_code}"
                    })
            except Exception as alt_error:
                logging.error(f"备用API获取对局详情出错: {str(alt_error)}")
                return jsonify({
                    "status": "error", 
                    "message": f"两种方法获取对局详情均失败，主方法: {response.status_code}, 备用方法: {str(alt_error)}"
                })
    
    except Exception as e:
        logging.error(f"获取对局详情时出错: {str(e)}")
        return jsonify({"status": "error", "message": f"获取对局详情时出错: {str(e)}"})

# 获取排位数据
@app.route('/api/get_ranked_stats', methods=['GET'])
def get_ranked_stats():
    puuid = request.args.get('puuid')
    
    if not puuid:
        return jsonify({"status": "error", "message": "缺少puuid参数"})
    
    connection_status = check_lcu_connection()
    response_data = json.loads(connection_status.get_data(as_text=True))
    if response_data["status"] != "connected":
        return jsonify({"status": "error", "message": "未连接到英雄联盟客户端"})

    try:
        # 使用LCU API获取排位数据
        url = f"https://127.0.0.1:{lcu_port}/lol-ranked/v1/ranked-stats/{puuid}"
        
        response = requests.get(
            url,
            verify=False,
            auth=('riot', lcu_token)
        )
        
        if response.status_code == 200:
            logging.info(f"成功获取召唤师 {puuid} 的排位数据")
            ranked_data = response.json()
            
            # 提取排位队列数据
            queues = []
            if "queues" in ranked_data:
                queues = ranked_data["queues"]
            
            return jsonify({"status": "success", "data": queues})
        else:
            logging.error(f"获取排位数据失败，状态码: {response.status_code}")
            
            # 尝试使用备用API路径（某些版本的客户端可能使用不同的路径）
            try:
                alt_url = f"https://127.0.0.1:{lcu_port}/lol-ranked/v1/ranked-stats-by-puuid/{puuid}"
                alt_response = requests.get(
                    alt_url,
                    verify=False,
                    auth=('riot', lcu_token)
                )
                
                if alt_response.status_code == 200:
                    logging.info(f"通过备用API成功获取召唤师 {puuid} 的排位数据")
                    alt_ranked_data = alt_response.json()
                    
                    # 提取排位队列数据
                    alt_queues = []
                    if "queues" in alt_ranked_data:
                        alt_queues = alt_ranked_data["queues"]
                    
                    return jsonify({"status": "success", "data": alt_queues})
                else:
                    return jsonify({
                        "status": "error", 
                        "message": f"获取排位数据失败，主API状态码: {response.status_code}，备用API状态码: {alt_response.status_code}"
                    })
            except Exception as alt_e:
                return jsonify({
                    "status": "error", 
                    "message": f"获取排位数据失败，状态码: {response.status_code}",
                    "details": response.text
                })
    
    except Exception as e:
        logging.error(f"获取排位数据时出错: {str(e)}")
        return jsonify({"status": "error", "message": f"获取排位数据时出错: {str(e)}"})

# 窗口控制API
@app.route('/api/minimize_window', methods=['POST'])
def minimize_window():
    # 在Flask中，这需要通过其他方式实现，如通过Electron API
    return jsonify({"status": "success", "message": "Minimize command received"})

@app.route('/api/close_window', methods=['POST'])
def close_window():
    # 在Flask中，这需要通过其他方式实现，如通过Electron API
    return jsonify({"status": "success", "message": "Close command received"})

def open_browser():
    """在新线程中打开浏览器，避免阻塞主线程"""
    if not IS_ELECTRON:
        webbrowser.open('http://localhost:5000')

if __name__ == '__main__':
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='JK应用')
    parser.add_argument('--no-web', action='store_true', help='不自动打开Web浏览器')
    parser.add_argument('--debug', action='store_true', help='启用调试模式')
    args = parser.parse_args()
    
    # 如果不在Electron环境下且没有--no-web参数，则自动打开浏览器
    if not IS_ELECTRON and not args.no_web:
        threading.Timer(1.5, open_browser).start()
    
    # 打印应用信息
    logging.info(f"静态文件路径: {resource_path('web')}")
    logging.info(f"当前工作目录: {os.getcwd()}")
    
    # 启动Flask应用
    app.run(host='0.0.0.0', port=5000, debug=args.debug)
