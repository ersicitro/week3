from rest_framework import serializers
from .models import Bill
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator
import re

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        # ... add other claims if needed ...

        return token

class BillSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Bill
        fields = ['id', 'user', 'remark', 'amount', 'type', 'category', 'date', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class UserRegistrationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all(), message="此用户名已被占用，请选择其他用户名。")]
    )
    password = serializers.CharField(write_only=True, required=True)
    # password2 = serializers.CharField(write_only=True, required=True, label="确认密码") # Optional: Add password confirmation

    class Meta:
        model = User
        fields = ('username', 'password') #, 'password2')

    # Optional: Add password confirmation validation
    # def validate(self, attrs):
    #     if attrs['password'] != attrs['password2']:
    #         raise serializers.ValidationError({"password2": "两次输入的密码不匹配。"})
    #     return attrs

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("密码长度不能少于6个字符。")
        
        if not re.search(r'[A-Za-z]', value):
            raise serializers.ValidationError("密码必须包含至少一个字母。")
            
        if not re.search(r'\d', value):
            raise serializers.ValidationError("密码必须包含至少一个数字。")
            
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user 