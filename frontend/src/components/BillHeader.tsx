import React, { useState, useEffect, useCallback } from 'react';
import { Card, Statistic, Typography, Button, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, LogoutOutlined } from '@ant-design/icons';
import { AxiosInstance } from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface BillHeaderProps {
  refreshKey: number;
  apiClient: AxiosInstance;
  username: string | null;
  onLogout: () => void;
}

const BillHeader: React.FC<BillHeaderProps> = ({ refreshKey, apiClient, username, onLogout }) => {
  const [summary, setSummary] = useState({ income: 0, expense: 0, date: new Date() });

  const fetchSummary = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/bills/today_summary/');
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchSummary();
  }, [refreshKey, fetchSummary]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      width: '100%',
      height: '100%'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0, marginLeft: 24 }}>记账小程序</Title>
        <Space className="custom-header-space" style={{ marginLeft: 24, marginRight: 16 }} wrap align="center">
          <Text>
            {username ? `${username}您好` : '您好'}，今天是{dayjs().format('YYYY年MM月DD日')}
          </Text>
          {username && (
            <Button 
              type="link"
              icon={<LogoutOutlined />}
              onClick={onLogout}
              style={{ 
                paddingLeft: '4px',
                paddingRight: '4px',
                color: '#1677ff',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              退出登录
            </Button>
          )}
        </Space>
      </div>
      <div style={{ 
        display: 'flex', 
        gap: 16,
        alignItems: 'center',
        marginRight: 24
      }}>
        <Card size="small" style={{ width: 180 }}>
          <Statistic
            title="今日收入"
            value={summary.income}
            precision={2}
            valueStyle={{ color: '#3f8600' }}
            prefix={<ArrowUpOutlined />}
          />
        </Card>
        <Card size="small" style={{ width: 180 }}>
          <Statistic
            title="今日支出"
            value={summary.expense}
            precision={2}
            valueStyle={{ color: '#cf1322' }}
            prefix={<ArrowDownOutlined />}
          />
        </Card>
      </div>
    </div>
  );
};

export default BillHeader; 