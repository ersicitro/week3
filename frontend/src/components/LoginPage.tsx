import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, message, Space } from 'antd';
import axios from 'axios';

const { Title, Link, Text } = Typography;

interface LoginPageProps {
  onLoginSuccess: (token: string, refreshToken: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form] = Form.useForm();

  const handleModeChange = (newMode: 'login' | 'register') => {
    setMode(newMode);
    form.resetFields(['password']);
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    if (mode === 'login') {
      try {
        const response = await axios.post('http://localhost:8001/api/token/', {
          username: values.username,
          password: values.password,
        });
        message.success('登录成功!');
        onLoginSuccess(response.data.access, response.data.refresh);
      } catch (error) {
        console.error('Login failed:', error);
        message.error('用户名或密码错误，请检查后重试');
      }
    } else {
      try {
        const response = await axios.post('http://localhost:8001/api/register/', {
          username: values.username,
          password: values.password,
        });
        message.success(response.data.message || '注册成功！请登录。');
        setMode('login');
        form.setFieldsValue({ username: values.username, password: '' });
      } catch (error) {
        console.error('Registration failed:', error);
        if (axios.isAxiosError(error) && error.response && error.response.data) {
          const errors = error.response.data;
          if (errors.username) {
            message.error(Array.isArray(errors.username) ? errors.username.join(' ') : errors.username);
          } else if (errors.password) {
            message.error(Array.isArray(errors.password) ? errors.password.join(' ') : errors.password);
          } else if (errors.detail) {
            message.error(errors.detail);
          } else {
            message.error('注册失败，请检查输入或稍后再试。');
          }
        } else {
          message.error('注册失败，请稍后再试。');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2}>{mode === 'login' ? '记账小程序登录' : '创建新账户'}</Title>
        </div>
        <Form
          form={form}
          name={mode}
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码!' },
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              {mode === 'login' ? '登录' : '注册'}
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            {mode === 'login' ? (
              <Text>
                还没有账户？ <Link onClick={() => handleModeChange('register')}>立即注册</Link>
              </Text>
            ) : (
              <Text>
                已有账户？ <Link onClick={() => handleModeChange('login')}>返回登录</Link>
              </Text>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage; 