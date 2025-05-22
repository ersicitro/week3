#!/usr/bin/env python
"""
从SQLite数据库导出数据为JSON格式
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

def export_data():
    """导出所有数据到JSON文件"""
    # 导出用户数据
    users_data = []
    for user in User.objects.all():
        users_data.append({
            'id': user.id,
            'username': user.username,
            'password': user.password,  # 加密后的密码
            'email': user.email,
            'is_staff': user.is_staff,
            'is_active': user.is_active,
            'is_superuser': user.is_superuser,
            'date_joined': str(user.date_joined),
            'last_login': str(user.last_login) if user.last_login else None,
        })

    # 导出账单数据
    bills_data = []
    for bill in Bill.objects.all():
        bills_data.append({
            'id': bill.id,
            'user_id': bill.user_id,
            'remark': bill.remark,
            'amount': str(bill.amount),
            'type': bill.type,
            'category': bill.category,
            'date': str(bill.date),
            'created_at': str(bill.created_at),
            'updated_at': str(bill.updated_at),
        })

    # 导出分析历史数据
    histories_data = []
    for history in AnalysisHistory.objects.all():
        histories_data.append({
            'id': history.id,
            'user_id': history.user_id,
            'history': history.history,
            'updated_at': str(history.updated_at),
        })

    # 将数据写入JSON文件
    all_data = {
        'users': users_data,
        'bills': bills_data,
        'analysis_histories': histories_data,
    }

    with open('exported_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=4)

    print(f"已导出 {len(users_data)} 个用户, {len(bills_data)} 个账单, {len(histories_data)} 个分析历史记录")
    return all_data

if __name__ == '__main__':
    export_data() 