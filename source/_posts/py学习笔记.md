---
title: py学习笔记
date: 2025-07-27 14:26:27
updated: 2026-01-28 14:07:00
description: 这是一篇关于 Python 基础语法的学习笔记。
keywords: Python, 编程入门
categories:
  - AI学习
tags:
  - Python
  - 学习笔记
---

# python学习

## 一.函数

### (1)print——输出函数  

print("     ") 打印引号内的内容

print（变量）打印变量的内容

print（“格式化字符串” % 变量1）

print（“格式化字符串” % （变量1，变量2……））

print（"xx",end="xx"）不希望换行，这样可以让后一个输出紧紧跟着前一个输出

print（"% n d"）可以使得格式对齐

### (2)type——查看变量类型

type（xx） 

### (3)input——输入函数（输入的是字符串）

字符串变量=input（“ 提示信息：”）

input输入的都是字符串

### (4)int，float——类型转换函数

xx=int（x）将x转化为一个整数

xx=float（x）将x转化为一个浮点数

xx=float/int（input（“ 提示信息：”））

### (5)自定义函数

1.定义函数（把函数封装）

def  xxx()【括号里可填写参数，定义时的参数为形参】 :

 “”“ xxx”“”（这样写注释 用ctrl+q可以查看函数的注释 ）

（正常这里有一个tab缩进）



在定义时，可以

def  xxxx（xxx，xxx=True/False）这样可以定义一个参数默认值，定义的参数默认值应该在参数列表的末尾



2.调用函数（使用已经封装好的函数 ）

import  xxx（文件名）

xxx.xxx() [前者为文件名，后者为函数名，括号内放置实参]

定义函数和调用函数的文件要在一个文件夹



当有多个缺省参数时，调用的时候，需要表明，比如：

def print_info（name,title="",gender=true）:

xxx

print_info（name,title="student",gender=true）



3.多值参数（在一个参数能够处理的参数个数时不确定的时候，要用多值参数）

*加参数名可以接受元组

**加参数名可以接受字典

一般在给多值参数命名的时候，习惯args存放元组，kwargs存放字典



元组和字典的拆包：

拆包的操作：在传递的元组前边加一个*

​					   在传递的字典前边加两个*

例子：

def demo( * args,**kwargs)：

​	print(args)

​	print(kwargs)

gl_nums=(1,2,3)

gl_xiaoming={"name":"小明","age":18}

demo(*gl_nums,**gl_xiaoming)



拆包可以让对应的数据类型传进去



### (6)return——返回值函数

return 之后的代码不会被执行

函数内  return xxx

函数外  xxx=xxx（）【第一个xxx是个变量，第二个xxx是函数】

return 后如果无值，会返回到函数调用的位置

### (7)list/tuple——转换函数

list（放元组）可以把元组转换成数组

tuple（放数组）可以把数组转换成元组

xxx=list/tuple(xxx)

## 二.变量

### 1.变量的定义

变量名 = 值

变量可以出现在等式中

### 2.变量的类型

#### （1）数字型

整数（int）

浮点数（float）

布尔类型（真假，bool，真用true是非0，假用false是0） 

复数型（complex）

#### （2）非数字型

##### 1.特点

1-6：都是一个序列，也就是容器；都可以用【】取值；

都可以遍历，计算长度，取最大/最小值，比较，删除，连接+或重复，还可以切片

##### 2.种类

###### 1）字符串（str，不可变）（用“ x” 或者' x' 引起来，字符串内再要用引号用另外一种引号）：带有%的字符串为格式化字符串。

%s——字符串，%d十进制整数（%6d表示输出的数显示位数，不足的地方用0补全），%f浮点数（% .n表示小数点后显示n位），%%输出%

len(字符串)获取字符串长度

字符串.count（字符串）可以查看小字符串在大字符串中出现的次数

字符串【下标】从字符串中去除单个字符

字符串.index（字符串）获得小字符串第一次出现的下标

index与find不同在，index不存在就报错，find不存在就返回-1

| xxx.capitalize | xxx.isidentifier | xxx.rindex     |
| -------------- | ---------------- | -------------- |
| xxx.casefold   | xxx.islower      | xxx.rjust      |
| xxx.center     | xxx.isnumeric    | xxx.rpartition |
| xxx.count      | xxx.isprintable  | xxx.rsplit     |
| xxx.encode     | xxx.isspace      | xxx.rstrip     |
| xxx.endswith   | xxx.istitle      | xxx.spilt      |
| xxx.expandtabs | xxx.isupper      | xxx.splitlines |
| xxx.find       | xxx.join         | xxx.startsith  |
| xxx.format     | xxx.ljust        | xxx.strip      |
| xxx.format_map | xxx.lower        | xxx.swapcase   |
| xxx.index      | xxx.lstrip       | xxx.title      |
| xxx.isalnum    | xxx.maketrans    | xxx.translate  |
| xxx.isalpha    | xxx.partition    | xxx.upper      |
| xxx.isdecimal  | xxx.replace      | xxx.zfill      |
| xxx.isdigit    | xxx.rfind        |                |

判断类型

| 方法                 | 说明                                                         |
| -------------------- | ------------------------------------------------------------ |
| `string.isspace()`   | 如果 string 中只包含空格，则返回 True                        |
| `string.isalnum()`   | 如果 string 至少有一个字符并且所有字符都是字母或数字则返回 True |
| `string.isalpha()`   | 如果 string 至少有一个字符并且所有字符都是字母则返回 True    |
| `string.isdecimal()` | 如果 string 只包含数字则返回 True，全角数字                  |
| `string.isdigit()`   | 如果 string 只包含数字则返回 True，全角数字、⑴、\u00b2       |
| `string.isnumeric()` | 如果 string 只包含数字则返回 True，全角数字，汉字数字        |
| `string.istitle()`   | 如果 string 是标题化的(每个单词的首字母大写)则返回 True      |
| `string.islower()`   | 如果 string 中包含至少一个区分大小写的字符，并且所有这些(区分大小写的)字符都是小写，则返回 True |
| `string.isupper()`   | 如果 string 中包含至少一个区分大小写的字符，并且所有这些(区分大小写的)字符都是大写，则返回 True |

查找与替换

| 方法                                                      | 说明                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `string.startswith(str)`                                  | 检查字符串是否以 str 开头，是则返回 True                     |
| `string.endswith(str)`                                    | 检查字符串是否以 str 结束，是则返回 True                     |
| `string.find(str, start=0, end=len(string))`              | 检测 str 是否包含在 string 中，如果指定范围则检查是否在范围内，找到返回开始的索引值，否则返回 -1 |
| `string.rfind(str, start=0, end=len(string))`             | 类似于 find() 函数，从右边开始查找                           |
| `string.index(str, start=0, end=len(string))`             | 跟 find() 方法类似，但 str 不存在时会报错                    |
| `string.rindex(str, start=0, end=len(string))`            | 类似于 index()，从右边开始                                   |
| `string.replace(old_str, new_str, num=string.count(old))` | 将 string 中的 old_str 替换成 new_str，如果指定 num 则替换不超过 num 次 |

大小写转换

| 方法             | 说明                         |
| ---------------- | ---------------------------- |
| xxx.capitalize() | 把字符串的第一个字符大写     |
| xxx.title()      | 把字符串的每个单词首字母大写 |
| xxx.lower()      | 转换xxx中所有大写字符为小写  |
| xxx.upper()      | 转换xxx中的小写字符为大学    |
| xxx.swapcase()   | 反转string中的大小写         |

文本对齐

string.xxx(width,"   ")【引号内可以用任意字符】

| 方法              | 说明                                                      |
| ----------------- | --------------------------------------------------------- |
| xxx.ljust(width)  | 返回一个原字符串左对齐，并用空格填充至长度width的新字符串 |
| xxx.rjust(width)  | 返回一个原字符串右对齐，并用空格填充至长度width的新字符串 |
| xxx.center(width) | 返回一个原字符串居中，并用空格填充至长度width的新字符串   |

去除空白字符

| 方法         | 说明                          |
| ------------ | ----------------------------- |
| xxx.lstrip() | 截掉xxx左边（开始）的空白字符 |
| xxx.retrip() | 截掉xxx右边（末尾）的空白字符 |
| xxx.strip()  | 截掉xxx左右两边的空白字符     |

拆分和连接

| 方法                   | 说明                                                         |
| ---------------------- | ------------------------------------------------------------ |
| xxx.partition(yyy)     | 把字符串xxx分成一个三元素的元组（yyy前边,yyy,yyy后边）       |
| xxx.rpartition(yyy)    | 类似于partintion()函数，不过是从右边开始查找                 |
| xxx.split(yyy=" ",num) | 以yyy为分隔符切片xxx，如果num有指定值，则仅分隔num+1个子字符串，yyy默认包含“\r” “\t” “\n” 和空格 |
| xxx.splitlines()       | 按照行("\r","\n","\r\n")分隔，返回一个包含各行作为元素的列表 |
| xxx.join()             | 以xxx作为分隔符，将yyy中的所有的元素（的字符串表示）合并为一个新的字符串 |

字符串切片[开始下标（空出来从最前开始）：结束下标（空出来切到最后）：长度（如果是负数，可以逆序切）]（最终切片结果不包含结束下标对应的字符）（也可以倒序，正序索引从0开始，倒叙从-1（倒数第二个）开始）



###### 2）列表（即数组）：一般保存相同类型的信息，下标从0开始

xxx=[]  (定义数组，不用规定大小，定义可以直接写，也可以循环input（）

| xxx.append | xxx.count  | xxx.insert | xxx.reverse |
| ---------- | ---------- | ---------- | ----------- |
| xxx.clear  | xxx.extend | xxx.pop    | xxx.sort    |
| xxx.copy   | xxx.index  | xxx.remove |             |

| 序号 | 分类 | 关键字/函数/方法       | 说明                     |
| ---- | ---- | ---------------------- | ------------------------ |
| 1    | 增加 | xxx.insert(下标，数据) | 在指定位置插入数据       |
|      |      | xxx.append(数据)       | 在末尾追加数据           |
|      |      | 列表1.extend(列表2)    | 将列表2的数据追加到列表1 |
| 2    | 修改 | xxx[下标]=数据         | 修改指定下标的数据       |
| 3    | 删除 | del xxx[下标]          | 删除指定下标的数据       |
|      |      | xxx.remove[数据]       | 删除第一个出现的指定数据 |
|      |      | xxx.pop                | 删除末尾数据             |
|      |      | xxx.pop(下标)          | 删除指定下标数据         |
|      |      | xxx.clear              | 清空列表                 |
| 4    | 统计 | len(xxx)               | 列表长度                 |
|      |      | xxx.count()            | 数据在列表中出现的次数   |
| 5    | 排序 | xxx.sort()             | 升序排序                 |
|      |      | xxx.sort(reverse=True) | 降序排序                 |
|      |      | xxx.reverse            | 逆序、反转               |
| 6    | 查询 | xxx.index(数据)        | 查询下标                 |

列表 += 列表 等于调用extend方法

extend 和append 的区别，extend在添加数据时（尤其是数组），是把数组拆开成多个元素添加，而append则是当时一个完整的元素添加



###### 3）元组（元组元素后续不可修改）：用（）定义，下标从0开始，一般保存不同类型的数据

多用于传递多个参数，或者返回多个数值，还可以保护数组的数据不被修改。格式字符串后的%（）本质是一个元组

tuple.count     tuple.index

tuple=()   特殊的单元组tuple=（xxx，）

xxx(变量)="%x %x %x" %tuple

print（xxx(变量)）



###### 4）字典（除数组外最灵活的类型）：一般存储描述一个物体的相关信息，且信息无序，字典用{}定义。字典中的key只能使用不可变类型



key 是索引，value是数据，键 值中间用 ：隔开

键是字典内唯一的

值可以取任何数据类，但键只能用字符串、数字和元组



xxx={"key 1":"xxx"，

​		 "key 2":xxx}

方法：

| xxx.clear    | xxx.items   | xxx.setdefault |
| ------------ | ----------- | -------------- |
| xxx.copy     | xxx.keys    | xxx.update     |
| xxx.fromkeys | xxx.pop     | xxx.values     |
| xxx.get      | xxx.popitem |                |

| xxx.keys()                | 展现所有key列表                              |
| ------------------------- | -------------------------------------------- |
| xxx.values()              | 展现所有value列表                            |
| xxx.items()               | 展现所有（key,value）元组列表                |
| xxx.get(key)              | 可以从字典中取值，key不存在不会报错          |
| xxx.pop(key)              | 删除指定键值对，key不存在会报错              |
| xxx.popitem()             | 随机删除一个键值对                           |
| xxx.clear()               | 清空字典                                     |
| xxx[key]                  | 可以从字典中取值，key不存在会报错            |
| xxx[key] = value          | 如果key存在，修改数据；反之，新建键值对      |
| xxx.setdefault(key,value) | 如果key存在，不会修改数据‘；反之，新建键值对 |
| 字典1.update(字典2)       | 将字典2的数据合并到字典1                     |
| del xxx[key]              | 删除指定键值对，key不存在会报错              |

多个字典可以放在一个数组里

##### 3.公共方法

内置的函数

| 函数             | 描述                                     | 备注                        |
| ---------------- | ---------------------------------------- | --------------------------- |
| len(item)        | 计算容器中元素的个数                     |                             |
| del(item)        | 删除变量                                 | del有两种方式               |
| max(item)        | 返回容器中元素最大值                     | 如果是字典，只针对key比较   |
| min(item)        | 返回容器中元素最小值                     | 如果是字典，只针对key比较   |
| cmp(item1,item2) | 比较两个值，返回值：-1小于//0等于//1大于 | python 3.x已经取消了cmp函数 |

字符串的比较规则：“0”<“A”<“a”

del a[i] 等价于 del (a[i])：前者是当关键字，后者是当函数



###### 切片

| 描述 | 表达式                                                       | 结果    | 可用的数据类型     |
| ---- | ------------------------------------------------------------ | ------- | ------------------ |
| 切片 | "0123456789"[开始下标（空出来从最前开始）：结束下标（空出来切到最后）：长度（如果是负数，可以逆序切）]（最终切片结果不包含结束下标对应的字符）（也可以倒序，正序索引从0开始，倒叙从-1（倒数第二个）开始） | "97531" | 字符串、列表、元组 |

切片使用**下标**来限定范围，从一个大的**字符串**中切除小的**字符串**

**列表和元组**都是**有序**的集合，可以通过**下标**来获取对应的数据

**字典**是一个**无序**的集合，使用**键值对**保存数据

###### 运算符

| 运算符       | 表达式          | 结果                      | 描述           | 可用的数据类型           |
| ------------ | --------------- | ------------------------- | -------------- | ------------------------ |
| +            | [1,2]+[3,4]     | [1,2,3,4]                 | 合并           | 字符串、列表、元组       |
| *            | ["HI!"]         | ["HI!","HI!","HI!","HI!"] | 重复           | 字符串、列表、元组       |
| in           | 3 in (1,2,3)    | True                      | 元素是否存在   | 字符串、列表、元组、字典 |
| not in       | 4 not in(1,2,3) | True                      | 元素是否不存在 | 字符串、列表、元组、字典 |
| >,>=,==,<,<= | (1,2,3)<(2,2,3) | True                      | 元素比较       | 字符串、列表、元组       |

### 3.变量的命名

#### （1）标识符（只能有字母，下划线和数字，同时开头不可以是数字，不能与关键字重名）

要见名知意

需要多个单词，最好都小写，用下划线连接，或者几个单词的第一个字母大写

#### （2）关键字

python内置的标识符

import可以导入各种库



### 4.变量的引用（记录数据的地址就叫引用）

id(xxx)  可以查看数据所在的内存地址



### 5.局部变量与全局变量

局部变量定义在函数内，出了函数就失效

全局变量不定义在函数变量，随时可用

直接在函数中使用赋值语句去修改全局变量，就是在函数内部出现一个与全局变量相同名字的局部变量

想在函数内直接修改，则需要：

global xxx

xxx=xxx



## 三.语法

### (1)判断语句 （if，else，elif）（同缩进的if else elif是一组）

if xxx：

（四个空格，或者一下tab）条件成立要做的事

else：



多个条件可以这样改，让格式整齐，让代码有可读性

if（（）

​	or（）

​	or（））：

### (2)循环（while循环：while ，break，continue ）（最好从0开始计数）

while 条件（判断 计数器 是否达到 目标次数）：

​	xxxx

​	处理条件（计数器变化）



break ：满足一个条件，退出循环，后续不再执行循环

continue（使用之前注意下计数是否更改，否则可能死循环）： 满足一个条件，退出本次循环，后续循环仍执行



while True/False(无限循环，由用户决定何时退出循环):

### (3)for循环（用于迭代遍历）

for xxx in xxx：(前一个是变量，后一个是数组/元组/字典，每次循环都会把数组的元素放在变量里，没有元素就会结束)

  还没写代码时，可以先写pass，pass表示一个占位符，能保证代码结构正确。

else:(遍历完成之后,else再执行，当for中有break退出之后，else不会再执行)

特殊的，字典的遍历：

for key in xxx:

​	print("%s : %s "% (key,xxx))



### (4)一行输入多个变量

i=1

M,D,C=[],[],[]

while i<=N:

  m,d,c=map(int,input().split())

  M.append(m)

  D.append(d)

  C.append(c)

  i+=1

## 四.算法

1.循环计算

i=0（可改）

sum=0

while i<101（可改）:

  sum+=i

  i+=1

print(sum)



2.哈希

hash（）

![image-20250722221405256](https://gitee.com/jiangnanqing/jiang-nuqing/raw/master/202507222214361.png)



3.一次接受多个return变量

x1,x2,...,xn=函数（），这样可以在返回值是元组时简单处理



4.变量交换

a=1

b=2

（1）用其他变量

c=a

a=b

b=c

（2）不用其他变量

a=a+b

b=a-b

a=a-b

第一行左侧的a等于二者的和，第二行左侧的b在新a减去原b后，等于原a，第三行左侧的a在新a减去新b（原a）后等于原来的b

（3）Python特有

a,b=(b,a)

等于是接受返回值是元组的情况



5.函数的递归（函数内部自己调用自己）

特点： 1.函数的内部代码相同，但针对的参数不同，处理的结果不同

​			2.当参数满足一个条件的时候，函数不再执行（如果没有出口，会出现死循环）

例子：

def sum_numbers(num):

​	print(num)

​	if num==1:

​		return

​		sum_numbers(num-1)

sum_numbers(3)



## 五.常见bug

（1）手误拼错

（2）一行写多个函数

（3）缩进错误（python对于缩进要求极为严苛，可以直接tab）

（4）python2.x不支持中文（选错ide）

## 六.注释（不要描述代码，要注释代码的作用）

###  （1）单行注释

 #xxxxxx（也可以在#后添加一个空格，可与代码同一行，也可与代码不同行）

### （2）多行注释（块注释）

"""（三个双引号）

xxxxx 

"""（三个双引号）

### （3）TODO注释

#TODO xxx   会高显，在完成之后去掉todo，这是为了提醒哪些功能没做完

## 七.运算符

###  1.算术运算符（括号可改变运算顺序）

#### 最低优先级

+加法运算（加号可以直接拼接字符串）

-减法运算

#### 第二优先级

*乘法运算

/除法运算

//取整除（好像是向下取整）

%取余数

#### 最高优先级

**幂次运算（）

#### 特殊用法

” xx “ * n（字符串 * 次数）表示字符串重复n次

### 2.逻辑运算符

and 与运算

or    或运算 

not  非运算

== 判断是否等于

!= 判断是否不等于

### 3.赋值运算符

=	直接赋值 	c=a

+=  	c=c+a    c+=a

-=	   c=c-a     c-=a

 ×=      c=c×a    c*×=a（×应该是星号）		

/=      c=c/a    c/=a

//=     取整赋值  c=c//a    c/=a

%=     取余赋值  c=c%a    c%=a

**=    幂次赋值  c=c××a   c××=a（×应该是星号）

### 4.处理非数字型数据的运算符

| 运算符       | 表达式          | 结果                      | 描述           | 可用的数据类型           |
| ------------ | --------------- | ------------------------- | -------------- | ------------------------ |
| +            | [1,2]+[3,4]     | [1,2,3,4]                 | 合并           | 字符串、列表、元组       |
| *            | ["HI!"]         | ["HI!","HI!","HI!","HI!"] | 重复           | 字符串、列表、元组       |
| in           | 3 in (1,2,3)    | True                      | 元素是否存在   | 字符串、列表、元组、字典 |
| not in       | 4 not in(1,2,3) | True                      | 元素是否不存在 | 字符串、列表、元组、字典 |
| >,>=,==,<,<= | (1,2,3)<(2,2,3) | True                      | 元素比较       | 字符串、列表、元组       |

in 在对字典操作的时候，判断的是 字典的键

in 和not in 叫做成员运算符

## 八.转义字符

\t  打出一个tab

\n 换行

\r  回车

以上三者都是空白字符

\\ \  反斜杠符号

\ '  单引号

\ " 双引号

## 九.工具库

 https://www.runoob.com/python3/python3-tutorial.html 

