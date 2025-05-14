from django.shortcuts import render
from rest_framework import viewsets, filters, status
from django_filters.rest_framework import DjangoFilterBackend
from .models import Bill
from .serializers import BillSerializer, UserRegistrationSerializer
from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.db import transaction
import logging
from django_filters import FilterSet, DateFilter
import requests
from django.conf import settings
import re
from datetime import datetime
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

class BillFilter(FilterSet):
    date_after = DateFilter(field_name='date', lookup_expr='gte')
    date_before = DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = Bill
        fields = ['type', 'category']

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        
        # 处理 type 和 category 的"或"逻辑
        type_value = self.data.get('type')
        category_value = self.data.get('category')
        
        if type_value:
            types = type_value.split(',')
            queryset = queryset.filter(type__in=types)
            
        if category_value:
            categories = category_value.split(',')
            # 直接使用 __in 查询，这样会返回匹配任一分类的记录
            queryset = queryset.filter(category__in=categories)
            
        return queryset

# Create your views here.

class BillViewSet(viewsets.ModelViewSet):
    serializer_class = BillSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = BillFilter
    search_fields = ['remark']

    def get_queryset(self):
        """
        This view should return a list of all the bills
        for the currently authenticated user.
        """
        user = self.request.user
        return Bill.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """Ensure the bill is associated with the logged-in user upon creation."""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def today_summary(self, request):
        today = timezone.now().date()
        # Filter by the currently authenticated user
        today_bills = Bill.objects.filter(user=request.user, date=today)
        
        income = today_bills.filter(type='income').aggregate(total=Sum('amount'))['total'] or 0
        expense = today_bills.filter(type='expense').aggregate(total=Sum('amount'))['total'] or 0
        
        return Response({
            'income': income,
            'expense': expense,
            'date': today
        })

    def create(self, request, *args, **kwargs):
        try:
            logger.info('Received data: %s', request.data)
            serializer = self.get_serializer(data=request.data)
            
            if serializer.is_valid():
                logger.info('Valid data: %s', serializer.validated_data)
                with transaction.atomic():
                    self.perform_create(serializer)
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            else:
                logger.error('Validation errors: %s', serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception('Error creating bill')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_deepseek(request):
    try:
        input_text = request.data.get('input', '')
        today = timezone.now().date()
        
        prompt = f"""今天是 {today.strftime('%Y-%m-%d')}，请帮我分析以下消费收入信息，将其按照时间、收入/支出、金额、类型、备注五个字段进行整理。备注中需要包含具体的商品名称、活动内容等详细信息。

时间处理规则：
- 如果提到"今天"，就用 {today.strftime('%Y-%m-%d')} 表示；
- 如果提到"昨天"，就用 {(today - timezone.timedelta(days=1)).strftime('%Y-%m-%d')} 表示；
- 如果提到"前天"，就用 {(today - timezone.timedelta(days=2)).strftime('%Y-%m-%d')} 表示；
- 如果没有提供具体日期，则使用今天的日期。

类型识别规则：
1. 饮食类：
- 如果提到"吃"、"喝"、"饭"、"餐"、"菜"、"火锅"、"烧烤"、"外卖"、"零食"、"水果"、"超市"等饮食相关词，记为"吃饭"

2. 购物类：
- 如果提到"买"、"购"、"衣服"、"裤子"、"鞋"、"包"、"电子产品"、"数码"、"家电"、"网购"、"淘宝"、"京东"等购物相关词，记为"购物"

3. 娱乐类：
- 如果提到"电影"、"游戏"、"KTV"、"唱歌"、"旅游"、"度假"、"健身"、"运动"、"演唱会"、"展览"、"门票"、"玩"等娱乐相关词，记为"娱乐"

4. 住房类：
- 如果提到"房租"、"水电"、"物业"、"维修"、"装修"、"家具"、"家居"、"电费"、"水费"、"燃气费"、"宽带"、"房贷"等住房相关词，记为"住房"

5. 工作类：
- 如果提到"办公"、"文具"、"打印"、"复印"、"培训"、"课程"、"考试"、"认证"、"工作餐"、"加班"、"差旅"等工作相关词，记为"工作"

6. 交通类：
- 如果提到"地铁"、"公交"、"打车"、"滴滴"、"高铁"、"火车"、"飞机"、"机票"、"加油"、"停车"、"汽车"、"修车"等交通相关词，记为"交通"

7. 医疗类：
- 如果提到"医院"、"看病"、"药"、"体检"、"门诊"、"挂号"、"手术"、"治疗"、"保健"、"医保"、"牙科"等医疗相关词，记为"医疗"

8. 宠物类：
- 如果提到"宠物"、"猫"、"狗"、"兽医"、"宠物医院"、"宠物食品"、"猫粮"、"狗粮"、"宠物用品"、"洗澡"、"美容"等宠物相关词，记为"宠物"

9. 收入类：
- 如果提到"工资"、"薪水"、"工钱"，记为"工资"
- 如果提到"奖金"、"奖励"、"年终奖"、"提成"，记为"奖金"
- 如果提到"红包"、"压岁钱"，记为"红包"
- 其他收入类型记为"其他"

10. 其他支出：
- 不属于以上类型的支出记为"生活"

需要分析的信息：
{input_text}

请严格按照以下格式返回（注意用|分隔，不要有多余空格）：
时间|收入/支出|金额|类型|备注
2024-03-21|支出|300|购物|李宁运动鞋
2024-03-21|收入|5000|工资|3月工资

只返回数据行，不要表头，不要其他解释。如果某个字段信息不存在，该位置留空，但分隔符要保留。例如：
||300|购物|运动鞋"""

        response = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.1
            },
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-9705e0c3c4b344c888d78a40773dad7d'
            }
        )
        response.raise_for_status()
        result = response.json()
        
        if 'choices' in result and len(result['choices']) > 0:
            analysis_result = result['choices'][0]['message']['content']
            
            # 解析返回的数据并创建账单
            created_bills = []
            for line in analysis_result.strip().split('\n'):
                if not line.strip():
                    continue
                    
                fields = line.split('|')
                if len(fields) != 5:  # 现在应该有5个字段
                    continue

                date_str, type_str, amount_str, category, remark = fields

                # 处理收支类型
                if not type_str or not amount_str:  # 收支和金额是必填项
                    continue
                    
                bill_type = 'income' if '收入' in type_str else 'expense'
                
                # 处理金额
                try:
                    amount = float(amount_str.replace('¥', '').replace(',', ''))
                except ValueError:
                    continue

                # 处理日期
                try:
                    date = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else timezone.now().date()
                except ValueError:
                    date = timezone.now().date()

                # 处理类型
                category_mapping = {
                    '工资': 'salary',
                    '奖金': 'bonus',
                    '红包': 'red_packet',
                    '吃饭': 'food',
                    '购物': 'shopping',
                    '娱乐': 'entertainment',
                    '生活': 'living',
                    '住房': 'housing',
                    '工作': 'work',
                    '交通': 'transportation',
                    '医疗': 'medical',
                    '宠物': 'pet',
                }
                category = category_mapping.get(category.strip(), 'other' if bill_type == 'income' else 'living')

                # 创建账单
                try:
                    bill = Bill.objects.create(
                        user=request.user,
                        type=bill_type,
                        amount=amount,
                        date=date,
                        category=category,
                        remark=remark.strip() if remark else None  # 添加备注字段
                    )
                    created_bills.append(bill)
                except Exception as e:
                    logger.error(f"创建账单失败: {str(e)}")
                    continue

            # 序列化创建的账单
            if created_bills:
                serializer = BillSerializer(created_bills, many=True)
                return Response({
                    'status': 'success',
                    'message': f'成功创建 {len(created_bills)} 条账单记录',
                    'result': analysis_result,
                    'created_bills': serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'status': 'error',
                    'message': '无法解析有效的账单信息',
                    'result': analysis_result
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(
                {'error': '无法获取分析结果'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except requests.exceptions.RequestException as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class UserRegistrationView(APIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "message": "用户注册成功！请使用您的新账户登录。",
                "username": user.username
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_text_view(request):
    """
    Receives a question from the user and their cached bill data,
    maintains conversation history, and returns the response.
    """
    user_question = request.data.get('text', '')
    bills_data = request.data.get('bills', [])
    conversation_history = request.data.get('conversation_history', [])
    
    if not user_question:
        return Response({'error': '请输入您的问题。'}, status=status.HTTP_400_BAD_REQUEST)

    # 构建消息历史
    messages = []
    
    # 如果是第一次对话，添加账单数据
    if not conversation_history:
        # 1. Format bill data for the LLM
        if not bills_data:
            formatted_bills_string = "用户目前没有任何账单记录。"
        else:
            # Simple text list format
            bill_lines = ["日期 | 收支 | 类型 | 金额 | 备注"]
            bill_lines.append("-----------------------------------")
            for bill in bills_data[:100]: # Limit to latest 100 records
                # Map category value to label for better readability
                category_label = bill['category'] # Default to value if no match found
                if bill['type'] == 'income':
                    category_label = dict(Bill.INCOME_CATEGORY_CHOICES).get(bill['category'], bill['category'])
                elif bill['type'] == 'expense':
                    category_label = dict(Bill.EXPENSE_CATEGORY_CHOICES).get(bill['category'], bill['category'])
                
                remark_str = bill['remark'] if bill['remark'] else "无"
                type_str = dict(Bill.TYPE_CHOICES).get(bill['type'], bill['type'])
                line = f"{bill['date']} | {type_str} | {category_label} | {float(bill['amount']):.2f} | {remark_str}"
                bill_lines.append(line)
            formatted_bills_string = "\n".join(bill_lines)

        # 添加系统消息，包含账单数据
        messages.append({
            'role': 'system',
            'content': f"""你是一个智能账单分析助手。以下是用户的账单记录：

--- 开始账单记录 ---
{formatted_bills_string}
--- 结束账单记录 ---

请注意：
- 你的回答应主要基于上面提供的账单数据。
- 如果数据中没有足够的信息来回答问题，请明确说明。
- 不要编造数据或回答数据之外的信息。
- 请用自然、流畅的中文来回答问题，就像与人对话一样。"""
        })
    else:
        # 如果不是第一次对话，添加之前的对话历史
        messages.extend(conversation_history)

    # 添加用户的新问题
    messages.append({
        'role': 'user',
        'content': user_question
    })
    
    logger.info(f"Sending analysis request to Deepseek for user {request.user.id}")
    logger.debug(f"Messages for user {request.user.id}:\n{messages}")

    # 调用 Deepseek API
    try:
        response = requests.post(
            'https://api.deepseek.com/v1/chat/completions',
            json={
                'model': 'deepseek-chat',
                'messages': messages,
                'temperature': 0.3
            },
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-9705e0c3c4b344c888d78a40773dad7d'
            },
            timeout=45
        )
        response.raise_for_status()
        result = response.json()
        
        logger.info(f"Received analysis response from Deepseek for user {request.user.id}")

        # 返回响应
        if 'choices' in result and len(result['choices']) > 0:
            analysis_result = result['choices'][0]['message']['content']
            # 更新对话历史
            updated_history = messages + [{'role': 'assistant', 'content': analysis_result}]
            return Response({
                'analysis': analysis_result,
                'conversation_history': updated_history
            }, status=status.HTTP_200_OK)
        else:
            logger.error(f"Deepseek response missing choices for user {request.user.id}. Response: {result}")
            return Response({'error': '未能从 Deepseek 获取有效分析结果。'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except requests.exceptions.Timeout:
        logger.error(f"Deepseek API request timed out for user {request.user.id}")
        return Response({'error': '请求分析服务超时，请稍后重试。'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error calling Deepseek API for user {request.user.id}: {e}")
        return Response({'error': '调用分析服务时出错。'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        logger.exception(f"Unexpected error during text analysis for user {request.user.id}")
        return Response({'error': '处理分析请求时发生内部错误。'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
