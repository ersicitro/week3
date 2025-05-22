#!/usr/bin/env python
"""
将JSON数据导入MySQL数据库
"""
import os
import sys
import json
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from bills.models import Bill, AnalysisHistory
from django.db import transaction

def import_data(json_file_path='exported_data.json'):
    """从JSON文件导入数据到MySQL数据库"""
    print(f"开始从 {json_file_path} 导入数据...")
    
    # 读取JSON文件
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"读取JSON文件失败: {e}")
        return False
    
    users_count = 0
    bills_count = 0
    histories_count = 0
    
    # 使用事务保证数据一致性
    with transaction.atomic():
        # 导入用户数据
        print("导入用户数据...")
        for user_data in data.get('users', []):
            try:
                # 检查用户是否已存在
                if not User.objects.filter(username=user_data['username']).exists():
                    user = User(
                        id=user_data['id'],
                        username=user_data['username'],
                        email=user_data['email'],
                        password=user_data['password'],
                        is_staff=user_data['is_staff'],
                        is_active=user_data['is_active'],
                        is_superuser=user_data['is_superuser'],
                    )
                    if user_data['date_joined']:
                        user.date_joined = user_data['date_joined']
                    if user_data['last_login']:
                        user.last_login = user_data['last_login']
                    user.save()
                    users_count += 1
                else:
                    print(f"用户 {user_data['username']} 已存在，跳过")
            except Exception as e:
                print(f"导入用户 {user_data.get('username', 'unknown')} 失败: {e}")
                continue
        
        # 导入账单数据
        print("导入账单数据...")
        for bill_data in data.get('bills', []):
            try:
                # 检查账单是否已存在
                if not Bill.objects.filter(id=bill_data['id']).exists():
                    user = User.objects.get(id=bill_data['user_id'])
                    bill = Bill(
                        id=bill_data['id'],
                        user=user,
                        remark=bill_data['remark'],
                        amount=bill_data['amount'],
                        type=bill_data['type'],
                        category=bill_data['category'],
                        date=bill_data['date'],
                        created_at=bill_data['created_at'],
                        updated_at=bill_data['updated_at'],
                    )
                    bill.save()
                    bills_count += 1
                else:
                    print(f"账单ID {bill_data['id']} 已存在，跳过")
            except Exception as e:
                print(f"导入账单ID {bill_data.get('id', 'unknown')} 失败: {e}")
                continue
        
        # 导入分析历史数据
        print("导入分析历史数据...")
        for history_data in data.get('analysis_histories', []):
            try:
                # 检查历史记录是否已存在
                if not AnalysisHistory.objects.filter(id=history_data['id']).exists():
                    user = User.objects.get(id=history_data['user_id'])
                    history = AnalysisHistory(
                        id=history_data['id'],
                        user=user,
                        history=history_data['history'],
                        updated_at=history_data['updated_at'],
                    )
                    history.save()
                    histories_count += 1
                else:
                    print(f"分析历史ID {history_data['id']} 已存在，跳过")
            except Exception as e:
                print(f"导入分析历史ID {history_data.get('id', 'unknown')} 失败: {e}")
                continue
    
    print(f"数据导入完成: {users_count} 个用户, {bills_count} 个账单, {histories_count} 个分析历史记录")
    return True

if __name__ == '__main__':
    if len(sys.argv) > 1:
        import_data(sys.argv[1])
    else:
        import_data() 