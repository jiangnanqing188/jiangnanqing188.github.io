---
title: 智能车日记；YOLOV5模型训练
date: 2026-01-29 10:00:00
description: 训练YOLOV5模型过程中的坎坷
keywords: YOLOV5模型
categories:
  - 比赛
tags:
  - 技术
  - 笔记
---

# YOLOV5模型训练

## 1.环境配置

### 1.安装软件

（1）安装Anaconda：这个没有什么难度，唯一要注意的就是**路径不要有中文**（碎碎念一句，很多国外软件都不接受中文路径，会报错）

https://www.anaconda.com/products/distribution

（2）安装pycharm

https://blog.csdn.net/2302_79334848/article/details/132128699

（3）安装pytorch

【1】查看CUDA版本

这个需要看你电脑上CUDA的版本，看你电脑上英伟达独立显卡的版本

```cmd
nvidia-smi
```

这个代码查看你的CUDA版本

【2】创建环境（这个步骤是因为有一些代码或者是项目，用的版本可能不同，所以要创建一个对应版本的）

环境以yolo命名为例，此过程在Anaconda上进行

在电脑上搜索Anaconda Powershell Prompt

输入代码

```
conda create -n yolo python==3.9
```

-n 和python之间是名字，想叫什么都可以，一般是项目名字，我们这里是使用的YOLOV5，所以取yolo

然后进入刚才的环境

```
conda activate yolo
```

yolo的位置同样是名字，和你创建的环境名字统一

【3】选择pytorch版本

https://pytorch.org/get-started/locally/

我们要选择的几个地方就是

Package 一栏选择 Conda（没有用pip也可以，操作一样，conda里用pip也合规）

Language 一栏选择 Python

Compute Platform 选择你电脑对应的，**如果没有对应的版本，选最接近你CUDA版本并且更新了一些的版本，** **如果你没有英伟达独显，下载cpu版本的**

【4】换源（可换可不换，速度取决于你网速，可以挂梯子）

代码如下，在Anaconda Powershell Prompt 里输入

```
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/

conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/

conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/pytorch/

conda config --set show_channel_urls yes
```

【5】然后复制pytorch的安装指令（在你创建的环境中）

![image-20260130212938735](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260130212945856.png)

最底下那一行

【6】然后输入

```
python

import torch

torch.cuda.is_available()
```

返回True就对了，然后输入exit()推出python

## 2.YOLOV5使用和部署

（1）源码下载：**https://github.com/ultralytics/yolov5**

（2）完成环境搭建

```
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
这个是一个代码，不是两个，显示问题
```

![image-20260130213935407](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260130213935489.png)

输入一个 **detect.py** 去测试，去看一下runs/detect/exp x（x是正整数）里有没有一些图片

（3）数据采集

【1】用小车摄像头采集

执行小车的代码（截止2026.1.30 我还没用过，先不说）

【2】用手机拍摄

提供两个方法：一个就是拍一段视频，然后让AI写一个抽帧的脚本，每10或15帧一抽，这样获得图片；另一个就是一张一张拍

（4）标记（最最最最最痛苦的一步！！！！！）

依旧提供两个方式

【1】makesense网站

https://www.makesense.ai/

![屏幕截图 2026-01-30 215200](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131100702954.png)

![屏幕截图 2026-01-30 215246](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131101024149.png)

![屏幕截图 2026-01-30 215426](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131100807882.png)

![屏幕截图 2026-01-30 215624](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131101035429.png)

![屏幕截图 2026-01-30 215653](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131100746841.png)

4和5的过程需要重复，你需要添加完所有你需要的标签之后，再去点6

8是导出标签，需要你标记玩完所有图片之后再点（我第一次是2600张照片，加油，慢慢标）

【2】X-AnyLabeling

先介绍一下工具：AnyLabeling是一款标注软件，跟makesense一样，X-AnyLabeling是基于AnyLabeling开发的，主要是加载了一些AI模型，通过AI标注

https://pan.baidu.com/s/1pgaw02inCvbEgOme9ajDJA?pwd=e528

![屏幕截图 2026-01-31 122625](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131191800427.png)

![屏幕截图 2026-01-31 123917](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131191818873.png)

![屏幕截图 2026-01-31 191613](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131191831847.png)

这个软件是按R之后进行标注的，具体的用法可以自己去网上查一下

软件的优点就是快捷键可以提高标注效率，同时，你有一个自己的模型之后，可以通过使用模型标注数据，再在该模型的基础上训练，可以不断修正模型。

选择模型的时候，选择的是一个yml文件，以下文件供参考，如果格式不对，模型是没法选择的。

```
# 1. 模型架构 (你是yolov5，这里必须写 yolov5，不能照抄图片的yolov8)
type: yolov5

# 2. 模型显示的名字 (随便起)
name: my_smartcar_model
display_name: SmartCar_Best

# 3. 你的ONNX文件路径 (⚠️非常重要！反斜杠 / 防止报错)
# 请务必确认 filenames 是 best.onnx（转ONNX代码自己搜一下）
model_path: F:/SmartCar/yolov5-master/runs/train/exp8/weights/best.onnx

# 4. 检测参数 (照抄图片里的标准参数)
nms_threshold: 0.45
confidence_threshold: 0.25

# 5. 你的8个类别 (顺序必须对！)
classes:
  - apple
  - pepper
  - pumpkin
  - pear
  - tomato
  - onion
  - good
  - bad
```

【3】建议训练方式

建议先用几百张或一千张照片训练出一个可以认出一些图片的模型来，然后用AI标注，之后更改标注有误或漏检的图片。我认为这样是比较高效的，一次性标注五六千张照片，我更认为你会有想死的想法。

（5）训练

【1】代码

以下文件是我更改过的，比较重要的文件

| 文件名                  | 下载链接                                   |
| :---------------------- | :----------------------------------------- |
| **train.py**            | [点击下载](/downloads/train.py)            |
| **val.py**              | [点击下载](/downloads/val.py)              |
| **mydata.yaml**         | [点击下载](/downloads/mydata.yaml)         |
| **mydata_yolov5s.yaml** | [点击下载](/downloads/mydata_yolov5s.yaml) |

特意提一下，train里有个多线程的选择，建议单线程，多线程可能会有报错然后中断，这不是代码问题，是多线程本身的问题

【2】终端训练代码

以下代码是从头训练或初次训练使用的

```
python train.py --weights yolov5s.pt --epochs 300 --batch-size 16 --data my_data/mydata.yaml --workers 0
```

以下代码是迭代训练使用的

```
python train.py --weights runs/train/exp9/weights/best.pt --epochs 100 --batch-size 16 --data my_data/mydata.yaml --workers 0
```

| 参数 (Argument)  | 设置                  | 含义与避坑指南 (Description)                                 |
| ---------------- | --------------------- | ------------------------------------------------------------ |
| **--weights**    | best.pt 或 yolov5s.pt | **初始权重**。<br>微调时指向上一轮效果最好的模型（站在巨人的肩膀上）；<br>重练时指向官方预训练模型。 |
| **--data**       | mydata.yaml           | **数据集配置文件**。<br>告诉代码去哪里找图片，以及标签有哪 8 类。 |
| **--epochs**     | 100 / 300             | **训练轮数**。<br>微调通常 100 轮足够收敛；从头练建议 300 轮以学得更透彻。 |
| **--batch-size** | 16                    | **批处理大小**。<br>决定一次塞给显卡多少张图。对于 RTX 4060 (8G显存)，设为 16 是性价比最高的选择。 |
| **--workers**    | **0**                 | **数据加载线程数 (⚠️重点)**。<br>Windows 系统下**必须设为 0**（强制单线程），否则会报 DataLoader worker exited 导致训练崩溃。 |

【3】迭代训练

用已有模型去标注新一轮图片，然后迭代，我认为效率最高的方式，这样，你就在使用“数据飞轮”了