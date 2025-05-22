import React, { useState, useEffect, useCallback, useRef } from 'react';
// Group Ant Design imports
import { Table, Button, Select, DatePicker, Space, Modal, Form, Input, InputNumber, message, Popconfirm, Tabs, Empty, Spin, Card, List, Avatar } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, EditOutlined, SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
// Group Axios imports
import { AxiosInstance, AxiosError } from 'axios';
// Group date library imports
import moment from 'moment';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs'; // Type import grouped with dayjs
import isBetween from 'dayjs/plugin/isBetween';
// Group local component/style imports
import BillForm from './BillForm';
import { Column, Line } from '@ant-design/plots';
import './BillList.css';

// --- Extend dayjs after all imports ---
dayjs.extend(isBetween);

// --- Destructure Ant Design components after imports ---
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { TextArea } = Input;

// --- Interfaces (Bill, BillFormValues, ChartDatum remain the same) ---
interface Bill {
    id: number;
    remark: string | null;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    created_at: string;
    updated_at: string;
}

interface BillFormValues {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    date: dayjs.Dayjs;
    remark?: string;
}

interface ChartDatum {
    category: string;
    value: number;
    type: string;
}

interface BillListProps {
    onDataChange: () => void;
    apiClient: AxiosInstance;
}

// --- Chat Message Interface ---
interface ChatMessage {
    id: number; // For unique key in List
    sender: 'user' | 'ai';
    content: string;
}


// --- Constants (INCOME_CATEGORIES, EXPENSE_CATEGORIES, categoryColorMapping remain the same) ---
const INCOME_CATEGORIES = [
    { value: 'salary', label: '工资' },
    { value: 'bonus', label: '奖金' },
    { value: 'red_packet', label: '红包' },
    { value: 'other', label: '其他' },
];

const EXPENSE_CATEGORIES = [
    { value: 'food', label: '吃饭' },
    { value: 'shopping', label: '购物' },
    { value: 'entertainment', label: '娱乐' },
    { value: 'living', label: '生活' },
    { value: 'housing', label: '住房' },
    { value: 'work', label: '工作' },
    { value: 'transportation', label: '交通' },
    { value: 'medical', label: '医疗' },
    { value: 'pet', label: '宠物' },
    { value: 'other', label: '其他支出' },
];

const categoryColorMapping: Record<string, string> = {
    // ... (colors remain the same) ...
    '工资': '#52c41a',
    '奖金': '#a0d911',
    '红包': '#fadb14',
    '其他': '#40a9ff',
    '吃饭': '#ff4d4f',
    '购物': '#ff7a45',
    '娱乐': '#ffa940',
    '生活': '#faad14',
    '住房': '#1890ff',
    '工作': '#2f54eb',
    '交通': '#722ed1',
    '医疗': '#eb2f96',
    '宠物': '#597ef7',
    '其他支出': '#bfbfbf',
};


const BillList: React.FC<BillListProps> = ({ onDataChange, apiClient }) => {
    // --- Existing States ---
    const [bills, setBills] = useState<Bill[]>(() => {
        // 从 localStorage 读取缓存的账单数据
        const cachedBills = localStorage.getItem('cachedBills');
        return cachedBills ? JSON.parse(cachedBills) : [];
    });
    const [loading, setLoading] = useState(false);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isTestModalVisible, setIsTestModalVisible] = useState(false);
    const [testInput, setTestInput] = useState('');
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [filters, setFilters] = useState({
        type: [] as string[],
        date: [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
        category: [] as string[],
    });
    const [selectedType, setSelectedType] = useState<'income' | 'expense' | null>(null);
    const [displayMode, setDisplayMode] = useState<'table' | 'chart' | 'analysis'>('table');

    // --- States for Analysis Chat ---
    const [analysisInput, setAnalysisInput] = useState<string>('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // 初始化聊天历史
    const initChatHistory = useCallback(async () => {
        try {
            const response = await apiClient.get<{ history: any[] }>('/api/analyze/history/');
            if (response.data.history && response.data.history.length > 0) {
                const messages: ChatMessage[] = response.data.history.map((msg, index) => ({
                    id: index,
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    content: msg.content
                }));
                setChatMessages(messages);
            }
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
        }
    }, [apiClient]);

    // 组件加载时初始化聊天历史
    useEffect(() => {
        initChatHistory();
    }, [initChatHistory]);

    // --- Auto-scroll useEffect ---
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // 更新 handleAnalysisSubmit 函数
    const handleAnalysisSubmit = async () => {
        const currentInput = analysisInput.trim();
        if (!currentInput) {
            message.warning('请输入需要分析的内容');
            return;
        }

        // Add user message to chat
        const userMessage: ChatMessage = {
            id: Date.now(),
            sender: 'user',
            content: currentInput
        };
        setChatMessages(prev => [...prev, userMessage]);
        setAnalysisInput('');
        setAnalysisLoading(true);

        try {
            // 使用缓存的账单数据构建请求
            const cachedBills = localStorage.getItem('cachedBills');
            const billsData = cachedBills ? JSON.parse(cachedBills) : [];
            
            const response = await apiClient.post<{ analysis: string, conversation_history: any[] }>('/api/analyze/', { 
                text: currentInput,
                bills: billsData // 每次都发送最新的账单数据
            });
            
            const aiMessage: ChatMessage = {
                id: Date.now() + 1,
                sender: 'ai',
                content: response.data.analysis
            };
            setChatMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Analysis request failed:", error);
            const axiosError = error as AxiosError<any>;
            const errorMessage = axiosError.response?.data?.detail || axiosError.response?.data?.error || '分析请求失败，请稍后再试';
            message.error(errorMessage);

            const errorAiMessage: ChatMessage = {
                id: Date.now() + 1,
                sender: 'ai',
                content: `抱歉，分析时遇到错误：${errorMessage}`
            };
            setChatMessages(prev => [...prev, errorAiMessage]);
        }
        setAnalysisLoading(false);
    };

    // 更新清除对话历史的函数
    const handleClearChat = () => {
        Modal.confirm({
            title: '确认清除对话',
            content: '确定要清除所有对话历史吗？',
            okText: '确定',
            cancelText: '取消',
            onOk: () => {
                setChatMessages([]);
            }
        });
    };

    // --- Existing Functions (fetchBills, handleAdd, handleDelete, etc.) ---
    // Ensure fetchBills uses apiClient if it doesn't already
    const fetchBills = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.type.length) {
                params.append('type', Array.isArray(filters.type) ? filters.type.join(',') : filters.type);
            }
            if (filters.date.length === 2 && filters.date[0] && filters.date[1]) {
                params.append('date_after', filters.date[0]);
                params.append('date_before', filters.date[1]);
            }
            if (filters.category.length) {
                params.append('category', Array.isArray(filters.category) ? filters.category.join(',') : filters.category);
            }
            console.log('Request params:', params.toString());
            const response = await apiClient.get<Bill[]>(`/api/bills/?${params.toString()}`);
            console.log('Response data:', response.data);
            // Sort by created_at descending as per backend logic
            const sortedBills = response.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setBills(sortedBills);
            // 更新缓存的账单数据
            localStorage.setItem('cachedBills', JSON.stringify(sortedBills));
        } catch (error) {
            console.error('Error fetching bills:', error);
            const axiosError = error as AxiosError<any>;
            if (axiosError.response?.status === 401) {
                message.error('会话已过期，请重新登录');
                // Handle logout/redirect logic here if needed
            } else {
                message.error('获取账单列表失败');
            }
        }
        setLoading(false);
    }, [apiClient, filters]);

    useEffect(() => {
        // Fetch bills when component mounts or filters change
         fetchBills();
    }, [fetchBills]); // fetchBills is now stable due to useCallback

     const handleAdd = useCallback(async (values: BillFormValues) => {
        console.log('Form values:', values);
        try {
            const formattedValues = {
                ...values,
                date: values.date.format('YYYY-MM-DD'),
            };
            console.log('Formatted values:', formattedValues);
            const response = await apiClient.post<Bill>('/api/bills/', formattedValues, {
                headers: { 'Content-Type': 'application/json' },
            });
            message.success('添加账单成功');
            setIsAddModalVisible(false);
            // 更新本地账单数据
            setBills(prevBills => {
                const newBills = [response.data, ...prevBills];
                localStorage.setItem('cachedBills', JSON.stringify(newBills));
                return newBills;
            });
            onDataChange();
        } catch (error) {
            console.error('Error adding bill:', error);
            const axiosError = error as AxiosError<any>;
            const errorMessage = axiosError.response?.data?.detail || axiosError.response?.data?.error || '添加账单失败';
            message.error(errorMessage);
            console.error('Error response:', axiosError.response?.data);
        }
    }, [apiClient, onDataChange]);

    const handleDelete = useCallback(async (id: number) => {
        try {
            await apiClient.delete(`/api/bills/${id}/`);
            message.success('删除成功');
            // 更新本地账单数据
            setBills(prevBills => {
                const newBills = prevBills.filter(bill => bill.id !== id);
                localStorage.setItem('cachedBills', JSON.stringify(newBills));
                return newBills;
            });
            onDataChange();
        } catch (error) {
            message.error('删除失败');
            console.error('Error deleting bill:', error);
        }
    }, [apiClient, onDataChange]);

    const handleEdit = (bill: Bill) => {
        setEditingBill(bill);
        setIsEditModalVisible(true);
    };

     const handleFormSubmit = useCallback(async (values: any) => {
        if (!editingBill) return;
        try {
            const formattedValues = {
                ...values,
                date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : undefined,
            };
            const response = await apiClient.put(`/api/bills/${editingBill.id}/`, formattedValues);
            message.success('修改成功');
            setIsEditModalVisible(false);
            setEditingBill(null);
            // 更新本地账单数据
            setBills(prevBills => {
                const newBills = prevBills.map(bill => 
                    bill.id === editingBill.id ? response.data : bill
                );
                localStorage.setItem('cachedBills', JSON.stringify(newBills));
                return newBills;
            });
            onDataChange();
        } catch (error) {
            message.error('操作失败');
            console.error('Error editing bill:', error);
        }
    }, [apiClient, editingBill, onDataChange]);

    const handleEditModalClose = () => {
        setIsEditModalVisible(false);
        setEditingBill(null);
    };

    const handleAddModalClose = () => {
        setIsAddModalVisible(false);
        setSelectedType(null); // Reset selected type if needed
    };

    // --- Existing Chart/Other Functions (getChartData, getLineChartData, callDeepseekAPI for other button) ---
     const getChartData = useCallback(() => {
        // ... (implementation remains the same) ...
         const categoryMap = new Map<string, { amount: number; type: string }>();
         const activeFilters = filters.type.length ? filters.type : ['income', 'expense']; // Consider all if no filter selected

         if (activeFilters.includes('income')) {
             INCOME_CATEGORIES.forEach(category => {
                 categoryMap.set(category.label, { amount: 0, type: '收入' });
             });
         }
         if (activeFilters.includes('expense')) {
             EXPENSE_CATEGORIES.forEach(category => {
                 categoryMap.set(category.label, { amount: 0, type: '支出' });
             });
         }

         bills.forEach(bill => {
             if (!activeFilters.includes(bill.type)) return; // Filter based on selected types

             const categories = bill.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
             const category = categories.find(c => c.value === bill.category);
             if (category) {
                 const label = category.label;
                 const amount = Number(bill.amount) || 0;
                 const type = bill.type === 'income' ? '收入' : '支出';
                 if (categoryMap.has(label)) { // Ensure only categories relevant to selected type are added
                     categoryMap.set(label, {
                         amount: (categoryMap.get(label)!.amount || 0) + amount,
                         type
                     });
                 }
             }
         });

         return Array.from(categoryMap.entries()).map(([category, data]) => ({
             category,
             value: Number(data.amount.toFixed(2)),
             type: data.type
         }));
    }, [bills, filters.type]); // Dependency on bills and selected type filter


      const getLineChartData = useCallback(() => {
         // ... (implementation remains the same, ensure it depends on filters and bills) ...
          const [startDateStr, endDateStr] = filters.date;
          if (!startDateStr || !endDateStr) return []; // Handle case where date range is not set

          const startDate = dayjs(startDateStr);
          const endDate = dayjs(endDateStr);
          // Use filters.type, default to 'expense' ONLY if chart is active AND no type filter selected
          const chartModeDefaultType = (displayMode === 'chart' && !filters.type.length) ? ['expense'] : filters.type;
          const selectedTypeValue = chartModeDefaultType.length === 1 ? chartModeDefaultType[0] : null; // Only works well for single type line charts

          if (!selectedTypeValue) return []; // Line chart might not make sense for 'all' types simultaneously

          const relevantCategories = selectedTypeValue === 'income'
            ? INCOME_CATEGORIES
            : selectedTypeValue === 'expense'
            ? EXPENSE_CATEGORIES
            : [];

          const categoryLabels = relevantCategories.map(c => c.label);
          const dailyData: { date: string; amount: number; category: string }[] = [];
          const dateCategoryMap = new Map<string, Map<string, number>>();

          bills.forEach(bill => {
              if (bill.type !== selectedTypeValue) return;
              const billDate = dayjs(bill.date);
               // Filter bills within the selected date range
              if (!billDate.isBetween(startDate, endDate, 'day', '[]')) return;


              const categoryObj = relevantCategories.find(c => c.value === bill.category);
              if (!categoryObj) return;

              const dateStr = billDate.format('YYYY-MM-DD');
              const categoryLabel = categoryObj.label;
              const amount = Number(bill.amount) || 0;

              if (!dateCategoryMap.has(dateStr)) {
                  dateCategoryMap.set(dateStr, new Map<string, number>());
              }
              const categoryMap = dateCategoryMap.get(dateStr)!;
              categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + amount);
          });

          let currentDate = startDate;
          while (currentDate.isBefore(endDate) || currentDate.isSame(endDate)) {
              const dateStr = currentDate.format('YYYY-MM-DD');
              const categoryMap = dateCategoryMap.get(dateStr) || new Map<string, number>();

              categoryLabels.forEach(label => {
                  dailyData.push({
                      date: currentDate.format('MM-DD'), // Format for X-axis display
                      amount: Number((categoryMap.get(label) || 0).toFixed(2)),
                      category: label,
                  });
              });
              currentDate = currentDate.add(1, 'day');
          }
          return dailyData;
     }, [bills, filters.date, filters.type, displayMode]); // Dependencies

     // This function likely belongs to the "自然语言输入" (Bill creation) Modal, keep it separate
      const callDeepseekAPI = useCallback(async (input: string) => {
        try {
            const response = await apiClient.post(
                '/api/deepseek/', // Endpoint for CREATING bills via NLP
                { input },
                { headers: { 'Content-Type': 'application/json' } }
            );
            if (response.data.status === 'success') {
                message.success(response.data.message);
                fetchBills();
                onDataChange(); // Refresh header summary
            } else {
                message.error(response.data.message || '处理失败');
            }
            return response.data;
        } catch (error) {
            console.error('调用 Deepseek API (for bill creation) 失败:', error);
            message.error('调用账单创建服务失败');
            throw error; // Re-throw to be caught by modal handler
        }
    }, [apiClient, fetchBills, onDataChange]); // Dependencies


    // Disabled date function
    const disabledDate = (current: dayjs.Dayjs) => {
        const twoYearsAgo = dayjs().subtract(2, 'year');
        const today = dayjs();
        return current && (current.isBefore(twoYearsAgo) || current.isAfter(today));
    };

    // Define table columns
     const columns: ColumnsType<Bill> = [
        { title: '日期', dataIndex: 'date', key: 'date', fixed: 'left' as const, render: (date: string) => moment(date).format('YYYY-MM-DD'), sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix() },
        { title: '收支', dataIndex: 'type', key: 'type', render: (type: string) => type === 'income' ? '收入' : '支出' },
        {
            title: '类型', dataIndex: 'category', key: 'category', render: (category: string, record: Bill) => {
                const categories = record.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                const categoryObj = categories.find(c => c.value === category);
                return categoryObj ? categoryObj.label : category;
            }
        },
        { title: '金额', dataIndex: 'amount', key: 'amount', render: (amount: number, record: Bill) => (<span style={{ color: record.type === 'income' ? '#3f8600' : '#cf1322' }}>{record.type === 'income' ? '+' : '-'}{amount}</span>), sorter: (a, b) => a.amount - b.amount },
        { title: '备注', dataIndex: 'remark', key: 'remark', render: (remark: string | null) => remark || '-' },
        {
            title: '操作', key: 'action', width: 100, fixed: 'right' as const, render: (_: any, record: Bill) => (
                <Space size={0}> {/* Reduce space */}
                    <Button type="link" onClick={() => handleEdit(record)} style={{ padding: '0 8px', color: '#1677ff' }}>编辑</Button>
                    <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
                        <Button type="link" onClick={() => handleDelete(record.id)} style={{ padding: '0 8px', color: '#1677ff' }}>删除</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];


    return (
        <div>
            {/* --- Tabs and Filters Area --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, marginTop: 0 }}>
                <Tabs
                    defaultActiveKey="table"
                    activeKey={displayMode}
                    onChange={(key) => {
                        setDisplayMode(key as 'table' | 'chart' | 'analysis');
                        if (key === 'chart') {
                            setFilters(prevFilters => ({ ...prevFilters, type: prevFilters.type.length === 1 ? prevFilters.type : ['expense'] }));
                        }
                    }}
                >
                    <TabPane tab="表格展示" key="table" />
                    <TabPane tab="图表展示" key="chart" />
                    <TabPane tab="智能分析" key="analysis" />
                </Tabs>
                <Space>
                    {/* Filters Area - Conditionally rendered */}
                     {displayMode !== 'analysis' && (
                         <>
                              <Select
                                 placeholder="收支"
                                 style={{ width: 120 }}
                                 onChange={(value) => setFilters({ ...filters, type: value ? [value] : [] })}
                                 allowClear={displayMode === 'table'} // Allow clear only in table mode? Or always?
                                 value={filters.type[0] || undefined} // Use undefined for placeholder to show
                             >
                                 {displayMode === 'table' && <Option value="">全部</Option>}
                                 <Option value="income">收入</Option>
                                 <Option value="expense">支出</Option>
                             </Select>
                             <Select
                                 placeholder="类型"
                                 style={{ width: 150 }}
                                 onChange={(value) => setFilters({ ...filters, category: value ? [value] : [] })}
                                 allowClear
                                 value={filters.category[0] || undefined} // Use undefined for placeholder
                             >
                                 <Option value="">全部</Option>
                                 {(!filters.type.length || filters.type.includes('income')) && INCOME_CATEGORIES.map(category => (<Option key={category.value} value={category.value}>{category.label}</Option>))}
                                 {(!filters.type.length || filters.type.includes('expense')) && EXPENSE_CATEGORIES.map(category => (<Option key={category.value} value={category.value}>{category.label}</Option>))}
                             </Select>
                             <RangePicker
                                 value={filters.date[0] && filters.date[1] ? [dayjs(filters.date[0]), dayjs(filters.date[1])] : undefined}
                                 onChange={(dates) => {
                                     const newDate = (dates && dates[0] && dates[1])
                                         ? dates.map(date => date!.format('YYYY-MM-DD'))
                                         : [dayjs().subtract(7, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]; // Default range on clear
                                     setFilters({ ...filters, date: newDate });
                                 }}
                                 disabledDate={disabledDate}
                                 ranges={{
                                     '今日': [dayjs(), dayjs()],
                                     '本周': [dayjs().subtract(7, 'day'), dayjs()],
                                     '近30天': [dayjs().subtract(30, 'day'), dayjs()],
                                     '近60天': [dayjs().subtract(60, 'day'), dayjs()],
                                     '近90天': [dayjs().subtract(90, 'day'), dayjs()],
                                 }}
                             />
                         </>
                     )}
                    {/* Action Buttons */}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setIsAddModalVisible(true); setSelectedType('expense'); }}>添加账单</Button>
                    <Button onClick={() => setIsTestModalVisible(true)}>自然语言记账</Button>
                </Space>
            </div>

            {/* --- Tab Content Area --- */}
            <div className="tab-content-area" style={{ marginTop: '16px' }}>
                 {(() => {
                    if (displayMode === 'table') {
                        return (
                             <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
                                 <Table 
                                     columns={columns} 
                                     dataSource={bills} 
                                     rowKey="id" 
                                     loading={loading} 
                                     scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }}
                                     pagination={{ pageSize: 10, showSizeChanger: false, showQuickJumper: true, showTotal: (total) => `共 ${total} 条记录` }}
                                     style={{ width: '100%' }}
                                 />
                             </div>
                         );
                    } else if (displayMode === 'chart') {
                        return (
                             <div style={{ display: 'flex', gap: '16px' }}>
                                 <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '0 8px' }}>
                                     <Column /* ...props... */
                                          data={getChartData()} xField="category" yField="value" colorField="category" 
                                          color={(datum: { category: string; [key: string]: any }) => categoryColorMapping[datum.category] || '#d9d9d9'} 
                                          seriesField="type" height={400} maxColumnWidth={50}
                                          label={{ position: 'top', formatter: (d: ChartDatum) => d.value > 0 ? `¥${d.value.toFixed(2)}` : '' }}
                                          yAxis={{ min: 0, label: { formatter: (v: number) => `¥${v.toFixed(2)}` } }} xAxis={{ label: { autoRotate: false } }}
                                          tooltip={{ title: (d: ChartDatum) => d.category, formatter: (d: ChartDatum) => ({ name: d.type, value: `¥${d.value.toFixed(2)}` }) }}
                                          padding={[0, 0, 8, 0]} // 上右下左的内边距
                                          style={{ margin: 0 }} // 移除组件默认边距
                                     />
                                 </div>
                                 <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '0 8px' }}>
                                     <Line /* ...props... */
                                          data={getLineChartData()} xField="date" yField="amount" seriesField="category" colorField="category" 
                                          color={(d: { category: string; [key: string]: any }) => categoryColorMapping[d.category] || '#d9d9d9'} 
                                          height={400} xAxis={{ type: 'cat', tickCount: 5 }} yAxis={{ label: { formatter: (v: number) => `¥${v.toFixed(2)}` } }}
                                          tooltip={{ title: (d: any) => d.date, formatter: (d: any) => ({ name: d.category, value: `¥${d.amount.toFixed(2)}` }) }}
                                          padding={[0, 0, 8, 0]} // 上右下左的内边距
                                          style={{ margin: 0 }} // 移除组件默认边距
                                     />
                                 </div>
                             </div>
                         );
                    } else if (displayMode === 'analysis') {
                        return (
                             <div className="chat-container">
                                 <div className="chat-header" style={{ 
                                     display: 'flex', 
                                     justifyContent: 'space-between', 
                                     alignItems: 'center', 
                                     marginBottom: '16px',
                                     padding: '0 16px' // 添加左右内边距
                                 }}>
                                     <h3 style={{ marginTop: '16px' }}>智能分析</h3>
                                     <Button onClick={handleClearChat} style={{ marginTop: '16px' }}>清除对话</Button>
                                 </div>
                                 <div className="chat-messages" ref={chatContainerRef}>
                                     <List
                                         itemLayout="horizontal"
                                         dataSource={chatMessages}
                                         renderItem={item => (
                                             <List.Item className={item.sender === 'user' ? 'user-message' : 'ai-message'}>
                                                 <List.Item.Meta
                                                     description={<div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>}
                                                 />
                                             </List.Item>
                                         )}
                                     />
                                     {analysisLoading && <div style={{textAlign: 'center', padding: '20px'}}><Spin tip="思考中..." /></div>}
                                 </div>
                                 <div className="chat-input-area">
                                     <Space.Compact style={{ width: '100%' }}>
                                         <TextArea
                                             rows={1}
                                             placeholder="请输入您想咨询的问题..."
                                             value={analysisInput}
                                             onChange={(e) => setAnalysisInput(e.target.value)}
                                             onPressEnter={(e) => {
                                                 if (!e.shiftKey && !analysisLoading) {
                                                    e.preventDefault();
                                                    handleAnalysisSubmit();
                                                 }
                                             }}
                                             disabled={analysisLoading}
                                             autoSize={{ minRows: 1, maxRows: 3 }}
                                         />
                                         <Button
                                             type="primary"
                                             icon={<SendOutlined />}
                                             onClick={handleAnalysisSubmit}
                                             loading={analysisLoading}
                                         />
                                     </Space.Compact>
                                 </div>
                             </div>
                         );
                    }
                    return null;
                })()}
            </div>


            {/* --- Modals --- */}
             <Modal title="添加账单" open={isAddModalVisible} onCancel={handleAddModalClose} footer={null} styles={{ body: { paddingTop: 20 } }}>
                 <Form onFinish={handleAdd} layout="vertical" initialValues={{ date: dayjs(), type: 'expense' }}>
                     <Form.Item name="type" label="收支" rules={[{ required: true, message: '请选择收支类型' }]}>
                         <Select placeholder="请选择收支类型" onChange={(value) => setSelectedType(value)}>
                             <Option value="income">收入</Option><Option value="expense">支出</Option>
                         </Select>
                     </Form.Item>
                     <Form.Item name="category" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
                         <Select placeholder="请选择类型">
                             {selectedType === 'income' && INCOME_CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                             {selectedType === 'expense' && EXPENSE_CATEGORIES.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                         </Select>
                     </Form.Item>
                     <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
                     <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}><DatePicker style={{ width: '100%' }} disabledDate={disabledDate}/></Form.Item>
                     <Form.Item name="remark" label="备注"><Input /></Form.Item>
                     <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Button type="primary" htmlType="submit">提交</Button></Form.Item>
                 </Form>
             </Modal>
             <Modal title="编辑账单" open={isEditModalVisible} onCancel={handleEditModalClose} footer={null} styles={{ body: { paddingTop: 20, paddingBottom: 0 } }}>
                 {editingBill && <BillForm initialValues={editingBill} onSubmit={handleFormSubmit} onCancel={handleEditModalClose} />}
             </Modal>
             <Modal title="自然语言记账" open={isTestModalVisible} onCancel={() => setIsTestModalVisible(false)} styles={{ body: { paddingTop: '20px' } }} footer={ [<Button key="submit" type="primary" onClick={async () => { try { await callDeepseekAPI(testInput); setIsTestModalVisible(false); setTestInput(''); } catch (error) {} }}>确认</Button>] }>
                 <Input placeholder="请描述你需要记录的事件" value={testInput} onChange={(e) => setTestInput(e.target.value)} />
             </Modal>

        </div>
    );
};

export default BillList;
