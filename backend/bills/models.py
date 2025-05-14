from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

class Bill(models.Model):
    TYPE_CHOICES = [
        ('income', '收入'),
        ('expense', '支出'),
    ]
    
    INCOME_CATEGORY_CHOICES = [
        ('salary', '工资'),
        ('bonus', '奖金'),
        ('red_packet', '红包'),
        ('other', '其他'),
    ]
    
    EXPENSE_CATEGORY_CHOICES = [
        ('food', '吃饭'),
        ('shopping', '购物'),
        ('entertainment', '娱乐'),
        ('living', '生活'),
        ('housing', '住房'),
        ('work', '工作'),
        ('transportation', '交通'),
        ('medical', '医疗'),
        ('pet', '宠物'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    remark = models.CharField(max_length=255, verbose_name='备注', blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='金额')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, verbose_name='收支')
    category = models.CharField(max_length=20, verbose_name='类型')
    date = models.DateField(verbose_name='日期')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '账单'
        verbose_name_plural = '账单'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.date} - {self.remark or '无备注'} - {self.amount}"
