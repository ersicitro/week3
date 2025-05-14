import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Button, Space } from 'antd';
import dayjs from 'dayjs';

interface BillFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  onCancel: () => void;
}

const BillForm: React.FC<BillFormProps> = ({ initialValues, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        date: dayjs(initialValues.date),
      });
      setSelectedType(initialValues.type);
      setAmount(initialValues.amount);
    }
  }, [initialValues, form]);

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    form.setFieldValue('category', undefined);
  };

  const handleAmountChange = (value: number | null) => {
    setAmount(value);
    form.setFieldValue('amount', value);
  };

  const incomeCategories = [
    { value: 'salary', label: '工资' },
    { value: 'bonus', label: '奖金' },
    { value: 'red_packet', label: '红包' },
    { value: 'other', label: '其他' },
  ];

  const expenseCategories = [
    { value: 'food', label: '餐饮' },
    { value: 'shopping', label: '购物' },
    { value: 'entertainment', label: '娱乐' },
    { value: 'living', label: '生活' },
    { value: 'housing', label: '住房' },
    { value: 'work', label: '工作' },
    { value: 'transportation', label: '交通' },
    { value: 'medical', label: '医疗' },
    { value: 'pet', label: '宠物' },
  ];

  return (
    <Form
      form={form}
      onFinish={onSubmit}
      layout="vertical"
      style={{ marginBottom: 0 }}
    >
      <Form.Item
        name="date"
        label="日期"
        rules={[{ required: true, message: '请选择日期' }]}
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        name="type"
        label="类型"
        rules={[{ required: true, message: '请选择类型' }]}
      >
        <Select onChange={handleTypeChange}>
          <Select.Option value="income">收入</Select.Option>
          <Select.Option value="expense">支出</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="category"
        label="分类"
        rules={[{ required: true, message: '请选择分类' }]}
      >
        <Select>
          {selectedType === 'income'
            ? incomeCategories.map(category => (
                <Select.Option key={category.value} value={category.value}>
                  {category.label}
                </Select.Option>
              ))
            : expenseCategories.map(category => (
                <Select.Option key={category.value} value={category.value}>
                  {category.label}
                </Select.Option>
              ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="amount"
        label="金额"
        rules={[{ required: true, message: '请输入金额' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={2}
          value={amount}
          onChange={handleAmountChange}
          formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      </Form.Item>

      <Form.Item
        name="remark"
        label="备注"
      >
        <Input />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit">
            {initialValues ? '保存' : '添加'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default BillForm; 