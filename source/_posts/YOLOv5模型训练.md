---
title: 智能车日记：YOLOv5 模型训练
date: 2026-01-29 10:00:00
description: 记录 YOLOv5 从环境配置、智能车数据采集与清洗、数据标注到模型训练的问题与经验。
keywords: YOLOv5, 计算机视觉, 智能车, 数据采集, 数据清洗, 模型训练
cover: /img/covers/yolov5-vision.webp
log_id: "003"
log_status: pending
log_system: Anaconda / PyTorch / YOLOv5
log_focus: 智能车数据采集 / 数据清洗 / 模型训练
project_id: yolov5
repro:
  environment: Anaconda / PyTorch / YOLOv5
  target: 自定义目标检测数据集
  evidence: 文章给出环境准备、智能车数据采集与清洗、数据配置、训练、验证和常见问题的完整步骤
  artifacts:
    - label: train.py
      href: /downloads/train.py
      kind: PYTHON
      description: YOLOv5 模型训练脚本
    - label: val.py
      href: /downloads/val.py
      kind: PYTHON
      description: YOLOv5 模型验证脚本
    - label: mydata.yaml
      href: /downloads/mydata.yaml
      kind: YAML
      description: 自定义数据集配置示例
    - label: mydata_yolov5s.yaml
      href: /downloads/mydata_yolov5s.yaml
      kind: YAML
      description: YOLOv5s 数据集配置示例
categories:
  - 工程实践
tags:
  - YOLOv5
  - Python
  - 计算机视觉
  - 数据标注
  - 数据清洗
  - 模型训练
---

## 1.环境配置

### 1.安装软件

（1）安装Anaconda：这个没有什么难度，唯一要注意的就是**路径不要有中文**（碎碎念一句，很多国外软件都不接受中文路径，会报错）

https://www.anaconda.com/products/distribution

（2）安装PyCharm

https://blog.csdn.net/2302_79334848/article/details/132128699

（3）安装PyTorch

【1】查看GPU驱动支持的CUDA版本

如果电脑配有NVIDIA独立显卡，可以先查看显卡型号、驱动版本以及驱动支持的最高CUDA版本

```cmd
nvidia-smi
```

需要注意，`nvidia-smi` 中显示的 CUDA Version 是当前驱动支持的最高CUDA版本，不一定等于本机安装的CUDA Toolkit版本

【2】创建环境（不同项目依赖的Python和库版本可能不同，因此建议为YOLOv5创建独立的虚拟环境）

下面以环境名`yolo`为例，此过程在Anaconda中进行

在电脑上搜索并打开Anaconda PowerShell Prompt

输入代码

```
conda create -n yolo python=3.9
```

`-n`后面是环境名称，可以自行设置。这里使用YOLOv5，因此将环境命名为`yolo`

然后进入刚才的环境

```
conda activate yolo
```

命令中的`yolo`需要与刚才创建的环境名称保持一致

【3】选择PyTorch版本

https://pytorch.org/get-started/locally/

我们要选择的几个地方就是

Package一栏选择与当前环境匹配的包管理方式。在Conda环境中也可以使用`pip`安装，但应避免在同一环境中无计划地混用多个来源

Language一栏选择Python

Compute Platform选择与显卡驱动兼容的CUDA运行时版本，具体以PyTorch官网给出的安装命令为准。**如果电脑没有NVIDIA独立显卡，选择CPU版本**

【4】换源（可换可不换，速度取决于你网速，可以挂梯子）

代码如下，在Anaconda Powershell Prompt 里输入

```
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free/

conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main/

conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/pytorch/

conda config --set show_channel_urls yes
```

【5】复制PyTorch官网生成的安装命令，并在刚才创建的环境中执行

![image-20260130212938735](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260421211500672.png)

最底下那一行

【6】然后输入

```
python

import torch

torch.cuda.is_available()
```

返回`True`说明PyTorch可以调用CUDA；如果返回`False`，需要检查显卡驱动、PyTorch构建版本和环境是否匹配。最后输入`exit()`退出Python交互环境

## 2.YOLOv5使用和部署

（1）下载源码：**https://github.com/ultralytics/yolov5**

（2）完成环境搭建

```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

上面是一条完整命令

![image-20260130213935407](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260130213935489.png)

运行`detect.py`进行推理测试。执行完成后，检查`runs/detect/exp`或`runs/detect/expN`目录中是否生成带检测结果的图片，其中`N`为正整数

（3）数据采集

数据集的采集还是要聚焦智能车的真实使用画面。图片不是越多越好，一千张几乎一样的图，很可能还不如两三百张来自不同路段、角度和光线的图有用。

【1】画面流畅时，直接用小车摄像头录视频

如果画面流畅，优先用实车最终部署的摄像头录视频。摄像头的安装高度、俯仰角和分辨率尽量与比赛时保持一致，让车按正常速度跑完路线，录完后再抽帧。

抽帧可以先从每隔10帧或15帧取一张开始，再根据车速和画面变化调整。不要把每一帧都留下来，相邻帧太像，只会增加标注量，并不会给模型提供多少新信息。

【2】画面不流畅时，再考虑手机或主从机录制

如果小车画面本身就在丢帧，可以用手机补拍，但尽量把手机固定在靠近车载摄像头的位置，不要从人眼高度随手拍。如果只是主机同时跑控制、推理和录制导致卡顿，也可以配一台从机专门订阅图像话题或接收视频流并保存。

手机和从机录制都是补充方案，最终数据集仍然要以真实车载摄像头数据为主。

【3】采集要覆盖真实变化

除了标准正面图，还要收集不同距离、角度、光线、背景和行驶状态下的画面，尤其是远处小目标、画面边缘、阴影、反光和干扰物。[Ultralytics的建议](https://docs.ultralytics.com/yolov5/tutorials/tips-for-best-training-results/)也是让数据尽可能代表最后的部署环境。

从同一段视频抽出的图不要随机分到训练集和验证集两边。最好按视频、路段或采集批次划分，避免验证集里出现训练图片的「双胞胎」，让指标看起来虚高。

（4）数据清洗

视频抽成图片以后，先别急着全部扔进标注软件。先洗一遍数据，既能减少无效标注，也能避免把错误信息教给YOLOv5。

【1】严重不清晰的，直接清掉

画面已经糊到无法稳定判断类别，或者根本看不清目标边界时，直接删掉。全黑帧、损坏图片、严重过曝或欠曝、镜头被挡住和只拍到地面的无效画面也可以直接清掉。

轻微运动模糊或局部阴影如果不影响人工判断，可以适当保留，因为这也是智能车真实行驶时会遇到的情况。

【2】目标只拍到一半，先按任务规则决定去留

如果目标只露出一半，而实车任务不要求识别这种残缺目标，建议不标注。但是不要把含有明显目标却没有框的图直接混进训练集，YOLOv5会把它当成背景学习。这类图最好整张移出，或者在不影响其他目标的情况下裁掉残缺区域。

如果车端本来就需要识别部分遮挡的目标，那就要在整个数据集里使用统一规则标注。[Ultralytics的标注建议](https://academy.ultralytics.com/courses/dataset-readiness-for-yolo/annotation-best-practices/)也强调，遮挡和残缺目标可以设定统一的可见比例阈值，但不能同类图片有时标、有时不标。

【3】连续几乎一样的图，只留有代表性的

视频抽帧最容易出现的问题就是重复。目标位置、大小、背景和光线几乎没变时，留1张清楚、有代表性的就够了。当距离、角度、遮挡或光线真正变化时，这些帧才提供了新信息。

【4】标注后再检查一遍

标注完成后再抽查漏标、错类别、过松或过紧的框、重复框和类别数量差距。使用模型预标注时也必须人工复核。训练开始后，还可以打开`runs/train/exp`中的`train_batch*.jpg`，检查边界框和类别索引是否正常。

可以适当保留少量真正不含目标的背景图来减少误检。Ultralytics建议背景图大约占数据集的0至10%，但「有目标却漏标」不等于背景图。其[数据质量检查](https://academy.ultralytics.com/courses/dataset-readiness-for-yolo/dataset-quality-control/)还建议重点检查近似重复图、数据划分泄漏和类别不平衡。数据这里没有清干净，先别急着怀疑YOLOv5模型和训练参数。

（5）数据标注（最最最最最痛苦的一步！！！！！）

依旧提供两个方式

【1】MakeSense网站

https://www.makesense.ai/

![屏幕截图 2026-01-30 215200](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131100702954.png)

![屏幕截图 2026-01-30 215246](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131101024149.png)

![屏幕截图 2026-01-30 215426](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260421211515991.png)

![屏幕截图 2026-01-30 215624](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131101035429.png)

![屏幕截图 2026-01-30 215653](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260421211519046.png)

4和5的过程需要重复，你需要添加完所有你需要的标签之后，再去点6

8是导出标签，需要完成所有图片的标注后再点击（我第一次是2600张照片，加油，慢慢标）

【2】X-AnyLabeling

先介绍一下工具：AnyLabeling是一款数据标注软件，功能与MakeSense类似。X-AnyLabeling在此基础上加入了多种模型，可以进行AI辅助标注

https://pan.baidu.com/s/1pgaw02inCvbEgOme9ajDJA?pwd=e528

![屏幕截图 2026-01-31 122625](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260421211523177.png)

![屏幕截图 2026-01-31 123917](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260131191818873.png)

![屏幕截图 2026-01-31 191613](https://raw.githubusercontent.com/jiangnanqing188/images/main/20260421211536029.png)

这个软件可以按`R`键进入标注操作，具体用法可以参考软件文档

软件的优点是可以通过快捷键提高标注效率。拥有自己的模型后，还可以先用模型对新数据进行预标注，再人工修正误检、漏检和边界框偏差，最后使用修正后的数据继续训练。

选择模型时需要加载YAML配置文件。以下内容供参考，字段或格式不正确时，软件将无法加载模型。

```
# 1. 模型类型（使用YOLOv5时必须填写yolov5，不能照抄图片中的yolov8）
type: yolov5

# 2. 模型名称和显示名称（可自定义）
name: my_smartcar_model
display_name: SmartCar_Best

# 3. ONNX模型文件路径（⚠️非常重要！Windows路径建议使用正斜杠，避免反斜杠转义问题）
# 请务必确认model_path指向实际导出的best.onnx文件
model_path: F:/SmartCar/yolov5-master/runs/train/exp8/weights/best.onnx

# 4. 推理阈值
nms_threshold: 0.45
confidence_threshold: 0.25

# 5. 8个类别（顺序必须与训练时的类别索引一致）
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

建议先用几百张或一千张图像训练一个初版模型，再用它进行辅助标注，之后人工修正误检和漏检。我认为这样效率更高；如果一次性手工标注五六千张照片，工作量确实会非常大。

（6）训练

【1】代码

以下文件是我更改过的，比较重要的文件

| 文件名                  | 下载链接                                   |
| :---------------------- | :----------------------------------------- |
| **train.py**            | [点击下载](/downloads/train.py)            |
| **val.py**              | [点击下载](/downloads/val.py)              |
| **mydata.yaml**         | [点击下载](/downloads/mydata.yaml)         |
| **mydata_yolov5s.yaml** | [点击下载](/downloads/mydata_yolov5s.yaml) |

特意提一下，`train.py`中的`--workers`控制数据加载子进程数。在Windows环境中，如果多进程数据加载导致训练中断，可以先设置为`0`，让数据在主进程中加载；环境稳定后再根据CPU、内存和存储性能逐步调大

【2】终端训练代码

以下代码用于基于官方预训练权重进行首次训练

```
python train.py --weights yolov5s.pt --epochs 300 --batch-size 16 --data my_data/mydata.yaml --workers 0
```

以下代码用于载入上一轮最佳权重，对更新后的数据集继续微调

```
python train.py --weights runs/train/exp9/weights/best.pt --epochs 100 --batch-size 16 --data my_data/mydata.yaml --workers 0
```

| 参数 (Argument)  | 设置                  | 含义与避坑指南 (Description)                                 |
| ---------------- | --------------------- | ------------------------------------------------------------ |
| **--weights**    | best.pt 或 yolov5s.pt | **初始权重文件**。<br>继续微调时指向上一轮效果较好的权重；<br>首次训练时可使用官方预训练权重。 |
| **--data**       | mydata.yaml           | **数据集配置文件**。<br>用于声明训练集、验证集路径以及类别名称。 |
| **--epochs**     | 100 / 300             | **训练轮数**。<br>具体数值应结合验证集指标、损失曲线和是否过拟合进行调整，不是固定值。 |
| **--batch-size** | 16                    | **批量大小**。<br>表示每次迭代输入模型的样本数，应根据显存占用和训练稳定性调整。RTX 4060（8 GB显存）可以从16开始尝试。 |
| **--workers**    | **0**                 | **数据加载子进程数（⚠️重点）**。<br>设置为`0`时由主进程同步加载数据；如果Windows下出现`DataLoader worker exited`等错误，可以先使用该设置排查。 |

【3】迭代训练

使用已有模型对新一轮图像进行预标注，人工复核后再继续训练。我认为这是效率较高的迭代方式，也就是常说的“数据飞轮”。
