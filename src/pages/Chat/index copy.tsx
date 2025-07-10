import zhData from '@/assets/emoji/zh.json';
import EmoticonPicker from '@/components/EmoticonPicker';
import MessageContent from '@/components/MessageContent';
import {
  getOnlineUserListUsingGet,
  listMessageVoByPageUsingPost,
} from '@/services/backend/chatController';
import { uploadFileByMinioUsingPost } from '@/services/backend/fileController';
import {
  createRedPacketUsingPost,
  getRedPacketDetailUsingGet,
  getRedPacketRecordsUsingGet,
  grabRedPacketUsingPost,
} from '@/services/backend/redPacketController';
import { wsService } from '@/services/websocket';
import { useModel } from '@@/exports';
// ... 其他 imports ...
import {
  CloseOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  GiftOutlined,
  PaperClipOutlined,
  PauseOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RightOutlined,
  SendOutlined,
  SmileOutlined,
  SoundOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { history } from '@umijs/max';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Radio,
  Spin,
  Tabs,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import styles from './index.less';

interface Message {
  id: string;
  content: string;
  sender: User;
  timestamp: Date;
  quotedMessage?: Message;
  mentionedUsers?: User[];
  region?: string;
  country?: string;
  workdayType?: 'single' | 'double' | 'mixed';
  currentWeekType?: 'big' | 'small';
}

interface User {
  id: string;
  name: string;
  avatar: string;
  level: number;
  isAdmin: boolean;
  status?: string;
  points?: number;
  region?: string;
  country?: string;
  avatarFramerUrl?: string;
  titleId?: number;
  titleIdList?: string;
}

interface Title {
  id: number;
  name: string;
  description: string;
}

// 添加歌曲类型定义
interface Song {
  id: string;
  name: string;
  artist: string;
  url: string;
  cover: string;
  album?: string;
}

// 添加APlayer声明
declare global {
  interface Window {
    APlayer: any;
  }
}

const ChatRoom: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [workdayType, setWorkdayType] = useState<'single' | 'double' | 'mixed'>('double');
  const [currentWeekType, setCurrentWeekType] = useState<'big' | 'small'>('big');
  const [inputValue, setInputValue] = useState('');
  const [isEmojiPickerVisible, setIsEmojiPickerVisible] = useState(false);
  const [isEmoticonPickerVisible, setIsEmoticonPickerVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const { initialState } = useModel('@@initialState');
  const { currentUser } = initialState || {};
  const [messageApi, contextHolder] = message.useMessage();
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isManuallyClosedRef = useRef(false);

  // 分页相关状态
  const [current, setCurrent] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const pageSize = 10;
  const [loadedMessageIds] = useState<Set<string>>(new Set());
  const loadingRef = useRef(false); // 添加loadingRef防止重复请求

  const [announcement, setAnnouncement] = useState<string>(
    '欢迎来到摸鱼聊天室！🎉 这里是一个充满快乐的地方~。致谢：感谢 yovvis 大佬赞助的服务器资源🌟，域名9月份过期，请移步新域名：<a href="https://yucoder.cn/" target="_blank" rel="noopener noreferrer">https://yucoder.cn/</a>。<br/>留言区🌟：🐟友 7878 留言：打倒绿头龟 渣男老 b 登',
  );
  const [showAnnouncement, setShowAnnouncement] = useState<boolean>(true);

  const [isComponentMounted, setIsComponentMounted] = useState(true);

  const [uploading, setUploading] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);

  const [notifications, setNotifications] = useState<Message[]>([]);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userIpInfo, setUserIpInfo] = useState<{ region: string; country: string } | null>(null);

  const inputRef = useRef<any>(null); // 添加输入框的ref

  const [isMentionListVisible, setIsMentionListVisible] = useState(false);
  const [mentionListPosition, setMentionListPosition] = useState({ top: 0, left: 0 });
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const mentionListRef = useRef<HTMLDivElement>(null);

  const [isRedPacketModalVisible, setIsRedPacketModalVisible] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState<number>(0);
  const [redPacketCount, setRedPacketCount] = useState<number>(1);
  const [redPacketMessage, setRedPacketMessage] = useState<string>('恭喜发财，大吉大利！');
  const [redPacketType, setRedPacketType] = useState<number>(1); // 1-随机红包 2-平均红包

  // 添加红包记录相关状态
  const [isRedPacketRecordsVisible, setIsRedPacketRecordsVisible] = useState(false);
  const [redPacketRecords, setRedPacketRecords] = useState<API.VO[]>([]);
  const [currentRedPacketId, setCurrentRedPacketId] = useState<string>('');
  const [redPacketDetail, setRedPacketDetail] = useState<API.RedPacket | null>(null);
  const [redPacketDetailsMap, setRedPacketDetailsMap] = useState<Map<string, API.RedPacket | null>>(
    new Map(),
  );
  const [isMusicSearchVisible, setIsMusicSearchVisible] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  // 添加防抖状态
  const [isSelectingMusic, setIsSelectingMusic] = useState(false);
  const selectMusicDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 添加搜索音乐的函数
  const handleMusicSearch = async () => {
    try {
      const response = await fetch(
        `https://api.kxzjoker.cn/api/163_search?name=${encodeURIComponent(searchKey)}&limit=20`,
      );
      const data = await response.json();
      setSearchResults(data.data || []);
    } catch (error) {
      messageApi.error('搜索音乐失败');
    }
  };

  // 添加选择音乐的函数（带防抖）
  const handleSelectMusic = async (music: any) => {
    // 如果已经在处理中，直接返回
    if (isSelectingMusic) {
      messageApi.warning('正在处理上一首歌，请稍候...');
      return;
    }

    // 清除之前的防抖定时器
    if (selectMusicDebounceRef.current) {
      clearTimeout(selectMusicDebounceRef.current);
    }

    try {
      setIsSelectingMusic(true);

      // 设置防抖延迟
      selectMusicDebounceRef.current = setTimeout(async () => {
        try {
          const response = await fetch('https://api.kxzjoker.cn/api/163_music', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: new URLSearchParams({
              url: music.id,
              level: 'lossless',
              type: 'json',
            }).toString(),
          });
          const data = await response.json();
          if (data.url) {
            // 发送消息
            const musicMessage = `🎵 ${music.name} - ${music.artists
              .map((a: any) => a.name)
              .join(',')} [music]${data.url}[/music][cover]${data.pic}[/cover]`;
            handleSend(musicMessage);
            setIsMusicSearchVisible(false);
            setSearchKey('');
            setSearchResults([]);
          }
        } catch (error) {
          messageApi.error('获取音乐链接失败');
        } finally {
          setIsSelectingMusic(false);
        }
      }, 1000); // 1秒防抖延迟
    } catch (error) {
      setIsSelectingMusic(false);
      messageApi.error('处理音乐选择时出错');
    }
  };

  useEffect(() => {
    return () => {
      if (selectMusicDebounceRef.current) {
        clearTimeout(selectMusicDebounceRef.current);
      }
    };
  }, []);

  // 添加发送频率限制相关的状态
  const [lastSendTime, setLastSendTime] = useState<number>(0);

  // 添加防止重复发送的状态
  const [lastSendContent, setLastSendContent] = useState<string>('');
  const [lastSendContentTime, setLastSendContentTime] = useState<number>(0);
  // 添加用户列表项高度常量
  const USER_ITEM_HEIGHT = 46;
  // 添加 ref 和状态来存储列表容器高度
  const userListRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0); // 初始值设为0

  // 添加一个状态来记录最新消息的时间戳
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<number>(Date.now());

  // 添加防抖相关的状态和引用
  const [newMessageCount, setNewMessageCount] = useState<number>(0);
  const newMessageTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoadingMoyu, setIsLoadingMoyu] = useState(false);

  const scrollToBottom = () => {
    const container = messageContainerRef.current;
    if (!container) return;

    // 使用 requestAnimationFrame 确保在下一帧执行滚动
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });

      // 添加二次检查，处理可能的延迟加载情况
      setTimeout(() => {
        if (container.scrollTop + container.clientHeight < container.scrollHeight) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    });
  };

  // 修改显示新消息提示的函数
  const showNewMessageNotification = (count: number) => {
    // 先清除之前的消息提示
    messageApi.destroy('newMessage');

    messageApi.info({
      content: (
        <div
          onClick={() => {
            // 点击时关闭消息提示
            messageApi.destroy('newMessage');
            scrollToBottom();
          }}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>收到 {count} 条新消息，点击查看</span>
          <CloseOutlined
            onClick={(e) => {
              e.stopPropagation(); // 阻止事件冒泡
              messageApi.destroy('newMessage');
            }}
            style={{
              marginLeft: '10px',
              cursor: 'pointer',
              color: '#999',
              fontSize: '12px',
            }}
          />
        </div>
      ),
      duration: 3,
      key: 'newMessage',
    });
  };

  // 修改计算高度的函数
  const updateListHeight = useCallback(() => {
    if (userListRef.current) {
      const containerHeight = userListRef.current.parentElement?.clientHeight || 0;
      const headerHeight = 40;
      const padding = 20;
      const newHeight = Math.max(containerHeight - headerHeight - padding, 200);
      setListHeight(newHeight);
    }
  }, []);

  // 修改监听逻辑
  useEffect(() => {
    // 创建 ResizeObserver 监听父容器大小变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === userListRef.current?.parentElement) {
          updateListHeight();
        }
      }
    });

    // 监听父容器
    if (userListRef.current?.parentElement) {
      resizeObserver.observe(userListRef.current.parentElement);
    }

    // 初始计算
    updateListHeight();

    // 同时保留窗口大小变化的监听
    window.addEventListener('resize', updateListHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateListHeight);
    };
  }, [updateListHeight]);

  const UserItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const sortedUsers = [...onlineUsers].sort((a, b) => (b.points || 0) - (a.points || 0));
    const user = sortedUsers[index];

    return (
      <div
        key={user.id}
        className={styles.userItem}
        onClick={() => handleSelectMention(user)}
        style={{ ...style, cursor: 'pointer' }}
      >
        <div className={styles.avatarWrapper}>
          <Popover content={<UserInfoCard user={user} />} trigger="hover" placement="right">
            <div className={styles.avatarWithFrame}>
              <Avatar src={user.avatar} size={28} />
            </div>
          </Popover>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user.name}</div>
          <div className={styles.userStatus}>{user.status}</div>
        </div>
        <span className={styles.levelBadge}>{getLevelEmoji(user.level)}</span>
      </div>
    );
  };

  // 修改 getIpInfo 函数
  const getIpInfo = async () => {
    try {
      // 先获取用户的 IP 地址
      const ipResponse = await fetch('https://ip.renfei.net/?lang=zh-CN');
      const ipData = await ipResponse.json();
      const userIp = ipData.clientIP;

      // 使用 allorigins.win 作为代理访问 ip-api.com
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        `http://ip-api.com/json/${userIp}?lang=zh-CN`,
      )}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();

      if (data.status === 'success') {
        console.log('IP信息:', {
          IP: data.query,
          国家: data.country,
          省份: data.regionName,
          城市: data.city,
          运营商: data.isp,
          经纬度: `${data.lat}, ${data.lon}`,
        });

        // 保存省份和国家信息
        setUserIpInfo({
          region: data.regionName,
          country: data.country,
        });
      }
    } catch (error) {
      console.error('获取IP信息失败:', error);
    }
  };

  // 在组件加载时获取IP信息
  useEffect(() => {
    getIpInfo();
  }, []);

  // 获取在线用户列表
  const fetchOnlineUsers = async () => {
    try {
      const response = await getOnlineUserListUsingGet();
      if (response.data) {
        const onlineUsersList = response.data.map((user) => ({
          id: String(user.id),
          name: user.name || '未知用户',
          avatar: user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
          level: user.level || 1,
          isAdmin: user.isAdmin || false,
          status: '在线',
          points: user.points || 0,
          avatarFramerUrl: user.avatarFramerUrl,
          titleId: user.titleId,
          titleIdList: user.titleIdList,
        }));

        // 添加机器人用户
        const botUser = {
          id: '-1',
          name: '摸鱼助手',
          avatar:
            'https://api.oss.cqbo.com/moyu/user_avatar/1/hYskW0jH-34eaba5c-3809-45ef-a3bd-dd01cf97881b_478ce06b6d869a5a11148cf3ee119bac.gif',
          level: 1,
          isAdmin: false,
          status: '在线',
          points: 9999,
          region: '鱼塘',
          country: '摸鱼岛',
          avatarFramerUrl: '',
          titleId: 0,
          titleIdList: '',
        };
        onlineUsersList.unshift(botUser);

        // 如果当前用户已登录且不在列表中，将其添加到列表
        if (
          currentUser?.id &&
          !onlineUsersList.some((user) => user.id === String(currentUser.id))
        ) {
          onlineUsersList.push({
            id: String(currentUser.id),
            name: currentUser.userName || '未知用户',
            avatar:
              currentUser.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
            level: currentUser.level || 1,
            isAdmin: currentUser.userRole === 'admin',
            status: '在线',
            points: currentUser.points || 0,
            avatarFramerUrl: currentUser.avatarFramerUrl,
            titleId: currentUser.titleId,
            titleIdList: currentUser.titleIdList,
          });
        }

        setOnlineUsers(onlineUsersList);
      }
    } catch (error) {
      console.error('获取在线用户列表失败:', error);
      messageApi.error('获取在线用户列表失败');
    }
  };
  // 修改 useEffect 来监听消息变化并自动滚动
  useEffect(() => {
    // 只有在以下情况才自动滚动到底部：
    // 1. 是当前用户发送的消息
    // 2. 用户已经在查看最新消息（在底部附近）

    if (isNearBottom) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages]); // 监听消息数组变化
  // 初始化时获取在线用户列表
  useEffect(() => {
    fetchOnlineUsers();
  }, []);

  const loadHistoryMessages = async (page: number, isFirstLoad = false) => {
    if (!hasMore || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);

      // 记录当前滚动高度
      const container = messageContainerRef.current;
      const oldScrollHeight = container?.scrollHeight || 0;

      const response = await listMessageVoByPageUsingPost({
        current: page,
        pageSize,
        roomId: -1,
        sortField: 'createTime',
        sortOrder: 'desc',
      });

      if (response.data?.records) {
        // 创建一个临时集合来跟踪当前请求中的消息ID
        const currentRequestMessageIds = new Set();

        const historyMessages = response.data.records
          .map((record) => {
            const messageId = String(record.messageWrapper?.message?.id);

            // 如果这条消息已经在当前请求中出现过，或者已经在loadedMessageIds中，则跳过
            if (currentRequestMessageIds.has(messageId) || loadedMessageIds.has(messageId)) {
              return null;
            }

            // 将消息ID添加到当前请求的集合中
            currentRequestMessageIds.add(messageId);

            return {
              id: messageId,
              content: record.messageWrapper?.message?.content || '',
              sender: {
                id: String(record.userId),
                name: record.messageWrapper?.message?.sender?.name || '未知用户',
                avatar:
                  record.messageWrapper?.message?.sender?.avatar ||
                  'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
                level: record.messageWrapper?.message?.sender?.level || 1,
                points: record.messageWrapper?.message?.sender?.points || 0,
                isAdmin: record.messageWrapper?.message?.sender?.isAdmin || false,
                region: record.messageWrapper?.message?.sender?.region || '未知地区',
                country: record.messageWrapper?.message?.sender?.country,
                avatarFramerUrl: record.messageWrapper?.message?.sender?.avatarFramerUrl,
                titleId: record.messageWrapper?.message?.sender?.titleId,
                titleIdList: record.messageWrapper?.message?.sender?.titleIdList,
              },
              timestamp: new Date(record.messageWrapper?.message?.timestamp || Date.now()),
              quotedMessage: record.messageWrapper?.message?.quotedMessage
                ? {
                    id: String(record.messageWrapper.message.quotedMessage.id),
                    content: record.messageWrapper.message.quotedMessage.content || '',
                    sender: {
                      id: String(record.messageWrapper.message.quotedMessage.sender?.id),
                      name: record.messageWrapper.message.quotedMessage.sender?.name || '未知用户',
                      avatar:
                        record.messageWrapper.message.quotedMessage.sender?.avatar ||
                        'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
                      level: record.messageWrapper.message.quotedMessage.sender?.level || 1,
                      points: record.messageWrapper.message.quotedMessage.sender?.points || 0,
                      isAdmin: record.messageWrapper.message.quotedMessage.sender?.isAdmin || false,
                      region:
                        record.messageWrapper?.message.quotedMessage?.sender?.region || '未知地区',
                      avatarFramerUrl:
                        record.messageWrapper?.message.quotedMessage?.sender?.avatarFramerUrl,
                      titleId: record.messageWrapper?.message.quotedMessage?.sender?.titleId,
                      titleIdList:
                        record.messageWrapper?.message.quotedMessage?.sender?.titleIdList,
                    },
                    timestamp: new Date(
                      record.messageWrapper.message.quotedMessage.timestamp || Date.now(),
                    ),
                  }
                : undefined,
              region: userIpInfo?.region || '未知地区',
            };
          })
          .filter(Boolean); // 过滤掉null值

        // 将新消息的ID添加到已加载集合中
        historyMessages.forEach((msg) => loadedMessageIds.add(msg.id));

        // 更新最新消息的时间戳（如果是首次加载）
        if (isFirstLoad && historyMessages.length > 0) {
          const latestMessage = historyMessages[historyMessages.length - 1];
          setLastMessageTimestamp(new Date(latestMessage.timestamp).getTime());
        }

        // 处理历史消息，确保正确的时间顺序（旧消息在上，新消息在下）
        if (isFirstLoad) {
          // 首次加载时，反转消息顺序，使最旧的消息在上面
          setMessages(historyMessages.reverse());
        } else {
          // 加载更多历史消息时，新的历史消息应该在当前消息的上面
          // 只有在有新消息时才更新状态
          if (historyMessages.length > 0) {
            setMessages((prev) => [...historyMessages.reverse(), ...prev]);
          }
        }

        setTotal(response.data.total || 0);

        // 更新是否还有更多消息
        const currentTotal = loadedMessageIds.size;
        setHasMore(currentTotal < (response.data.total || 0));

        // 只有在成功加载新消息时才更新页码
        if (historyMessages.length > 0) {
          setCurrent(page);
        }

        // 如果是首次加载，将滚动条设置到底部
        if (isFirstLoad) {
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        } else {
          // 保持滚动位置
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - oldScrollHeight;
            }
          });
        }
      }
    } catch (error) {
      messageApi.error('加载历史消息失败');
      console.error('加载历史消息失败:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // 检查是否在底部
  const checkIfNearBottom = () => {
    const container = messageContainerRef.current;
    if (!container) return;

    const threshold = 100; // 距离底部100px以内都认为是在底部
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    setIsNearBottom(distanceFromBottom <= threshold);
  };

  // 修改滚动处理函数
  const handleScroll = () => {
    const container = messageContainerRef.current;
    if (!container || loadingRef.current || !hasMore) return;

    // 检查是否在底部
    checkIfNearBottom();

    // 当滚动到顶部时加载更多
    if (container.scrollTop === 0) {
      // 更新当前页码，加载下一页
      const nextPage = current + 1;
      if (hasMore) {
        loadHistoryMessages(nextPage);
      }
    }
  };

  // 初始化时加载历史消息
  useEffect(() => {
    loadHistoryMessages(1, true);
  }, []);

  // 添加滚动监听
  useEffect(() => {
    const container = messageContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [loadingRef.current, hasMore, current]);

  // 处理图片上传
  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);

      // 如果文件大小超过 1MB，进行压缩
      if (file.size > 1024 * 1024) {
        const compressedFile = await compressImage(file);
        if (compressedFile) {
          file = compressedFile;
        }
      }

      // const res = await uploadTo111666UsingPost(
      //   {},  // body 参数
      //   file,  // 文件参数
      //   {  // 其他选项
      //     headers: {
      //       'Content-Type': 'multipart/form-data',
      //     },
      //   }
      // );

      // if (!res.data || res.data === 'https://i.111666.bestnull') {
      // 如果上传失败或返回的是兜底URL，使用备用上传逻辑
      const fallbackRes = await uploadFileByMinioUsingPost(
        { biz: 'user_file' }, // 业务标识参数
        {}, // body 参数
        file, // 文件参数
        {
          // 其他选项
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (!fallbackRes.data) {
        throw new Error('图片上传失败');
      }

      // 设置预览图片
      setPendingImageUrl(fallbackRes.data);
      // } else {
      //   // 设置预览图片
      //   setPendingImageUrl(res.data);
      // }
    } catch (error) {
      messageApi.error(`上传失败：${error}`);
    } finally {
      setUploading(false);
    }
  };

  // 添加图片压缩函数
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 如果图片尺寸过大，先缩小尺寸
          const maxDimension = 2000; // 最大尺寸
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建画布上下文'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // 尝试不同的质量级别，直到文件大小小于 1MB
          let quality = 0.9;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          while (compressedDataUrl.length > 1024 * 1024 && quality > 0.1) {
            quality -= 0.1;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          // 将 DataURL 转换回 File 对象
          const arr = compressedDataUrl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);

          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }

          const compressedFile = new File([u8arr], file.name, { type: mime || 'image/jpeg' });
          resolve(compressedFile);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
    });
  };

  // 处理粘贴事件
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleImageUpload(file);
        }
        break;
      }
    }
  };

  // 在 handleSend 函数之前添加取消引用的函数
  const handleCancelQuote = () => {
    setQuotedMessage(null);
  };

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);

      // 调用后端上传接口
      const res = await uploadFileByMinioUsingPost(
        { biz: 'user_file' }, // 业务标识参数
        {}, // body 参数
        file, // 文件参数
        {
          // 其他选项
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (!res.data) {
        throw new Error('文件上传失败');
      }

      // 获取文件的访问URL
      const fileUrl = res.data;
      console.log('文件上传地址：', fileUrl);
      setPendingFileUrl(fileUrl);

      messageApi.success('文件上传成功');
    } catch (error) {
      messageApi.error(`文件上传失败：${error}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // 移除待发送的文件
  const handleRemoveFile = () => {
    setPendingFileUrl(null);
  };

  // 添加滚动到指定消息的函数
  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 添加高亮效果
      messageElement.classList.add(styles.highlighted);
      setTimeout(() => {
        messageElement.classList.remove(styles.highlighted);
      }, 2000);
    }
  };

  // 添加处理@消息的函数
  const handleMentionNotification = (message: Message) => {
    if (message.mentionedUsers?.some((user) => user.id === String(currentUser?.id))) {
      messageApi.info({
        content: (
          <div onClick={() => scrollToMessage(message.id)}>
            {message.sender.name} 在消息中提到了你
          </div>
        ),
        duration: 5,
        key: message.id,
      });
      setNotifications((prev) => [...prev, message]);
    }
  };

  // 修改 handleChatMessage 函数
  const handleChatMessage = (data: any) => {
    const otherUserMessage = data.data.message;
    const messageTimestamp = new Date(otherUserMessage.timestamp).getTime();

    // 只处理其他用户的消息
    if (otherUserMessage.sender.id !== String(currentUser?.id)) {
      // 判断是否是真正的新消息（时间戳大于当前最新消息的时间戳）
      const isNewMessage = messageTimestamp > lastMessageTimestamp;

      setMessages((prev) => {
        // 添加新消息
        const newMessages = [...prev, { ...otherUserMessage }];

        // 检查是否在底部
        const container = messageContainerRef.current;
        if (container) {
          const threshold = 30; // 30px的阈值
          const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
          const isNearBottom = distanceFromBottom <= threshold;

          // 只有在不在底部且是真正的新消息时，才累计新消息数量
          if (!isNearBottom && isNewMessage) {
            setNewMessageCount((prev) => prev + 1);

            // 清除之前的定时器
            if (newMessageTimerRef.current) {
              clearTimeout(newMessageTimerRef.current);
            }

            // 设置新的定时器，1秒后显示合并的提示
            newMessageTimerRef.current = setTimeout(() => {
              showNewMessageNotification(newMessageCount + 1);
              setNewMessageCount(0);
            }, 1000);
          }

          // 只有在底部时才限制消息数量
          if (isNearBottom && newMessages.length > 25) {
            return newMessages.slice(-25);
          }
        }
        return newMessages;
      });

      // 如果是新消息，更新最新消息时间戳
      if (isNewMessage) {
        setLastMessageTimestamp(messageTimestamp);
        handleMentionNotification(otherUserMessage);
      }

      // 实时检查是否在底部
      const container = messageContainerRef.current;
      if (container) {
        const threshold = 30;
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom <= threshold) {
          setTimeout(scrollToBottom, 100);
          // 如果滚动到底部，清除新消息计数和定时器
          setNewMessageCount(0);
          if (newMessageTimerRef.current) {
            clearTimeout(newMessageTimerRef.current);
            newMessageTimerRef.current = null;
          }
        }
      }
    }
  };

  const handleUserMessageRevoke = (data: any) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== data.data));
    setTotal((prev) => Math.max(0, prev - 1));
  };

  const handleUserOnline = (data: any) => {
    setOnlineUsers((prev) => [
      ...prev,
      ...data.data.filter(
        (newUser: { id: string }) => !prev.some((user) => user.id === newUser.id),
      ),
    ]);
  };

  const handleUserOffline = (data: any) => {
    setOnlineUsers((prev) => prev.filter((user) => user.id !== data.data));
  };

  // 修改 WebSocket 连接逻辑
  useEffect(() => {
    setIsComponentMounted(true);
    isManuallyClosedRef.current = false;

    // 只有当用户已登录时才建立WebSocket连接
    if (currentUser?.id) {
      const token = localStorage.getItem('tokenValue');
      if (!token) {
        messageApi.error('请先登录！');
        return;
      }

      // 添加消息处理器
      wsService.addMessageHandler('chat', handleChatMessage);
      wsService.addMessageHandler('userMessageRevoke', handleUserMessageRevoke);
      wsService.addMessageHandler('userOnline', handleUserOnline);
      wsService.addMessageHandler('userOffline', handleUserOffline);

      // 连接WebSocket
      wsService.connect(token);

      return () => {
        setIsComponentMounted(false);
        isManuallyClosedRef.current = true;
        // 移除消息处理器
        wsService.removeMessageHandler('chat', handleChatMessage);
        wsService.removeMessageHandler('userMessageRevoke', handleUserMessageRevoke);
        wsService.removeMessageHandler('userOnline', handleUserOnline);
        wsService.removeMessageHandler('userOffline', handleUserOffline);
      };
    }
  }, [currentUser?.id]);

  // 修改 handleSend 函数
  const handleSend = (customContent?: string) => {
    // Check if the message is a workday type command
    if (customContent?.startsWith('/workday ')) {
      const type = customContent.split(' ')[1];
      if (['single', 'double', 'mixed'].includes(type)) {
        setWorkdayType(type as 'single' | 'double' | 'mixed');
        messageApi.success(
          `工作制已设置为${type === 'single' ? '单休' : type === 'double' ? '双休' : '大小周'}`,
        );
        return;
      }
    }

    // Check if the message is a week type command
    if (customContent?.startsWith('/week ')) {
      const type = customContent.split(' ')[1];
      if (['big', 'small'].includes(type)) {
        setCurrentWeekType(type as 'big' | 'small');
        messageApi.success(`当前周类型已设置为${type === 'big' ? '大周' : '小周'}`);
        return;
      }
    }
    // 检查发送冷却时间
    const now = Date.now();
    if (now - lastSendTime < 1000) {
      // 限制每秒最多发送一条消息
      messageApi.warning('发送太快了，请稍后再试');
      return;
    }

    let content = customContent || inputValue;

    // 检查是否包含 iframe 标签
    const iframeRegex = /\<iframe.*?\>.*?\<\/iframe\>/gi;
    if (iframeRegex.test(content)) {
      messageApi.warning('为了安全考虑，不支持 iframe 标签');
      return;
    }

    // 如果有待发送的图片，将其添加到消息内容中
    if (pendingImageUrl) {
      content = `[img]${pendingImageUrl}[/img]${content}`;
    }

    // 如果有待发送的文件，将其添加到消息内容中
    if (pendingFileUrl) {
      content = `[file]${pendingFileUrl}[/file]${content}`;
    }

    if (!content.trim() && !pendingImageUrl && !pendingFileUrl) {
      // 使用一个唯一的key来确保消息只显示一次
      messageApi.warning({
        content: '请输入消息内容',
        key: 'emptyMessage',
      });
      return;
    }

    // 检查是否重复发送相同内容
    if (content === lastSendContent && now - lastSendContentTime < 10000) {
      // 10秒内不能发送相同内容
      messageApi.warning('请勿重复发送相同内容，请稍后再试');
      return;
    }

    if (!currentUser?.id) {
      messageApi.error('请先登录！');
      return;
    }

    // 解析@用户
    const mentionedUsers: User[] = [];
    const mentionRegex = /@([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedName = match[1];
      const mentionedUser = onlineUsers.find((user) => user.name === mentionedName);
      if (mentionedUser) {
        mentionedUsers.push(mentionedUser);
      }
    }

    const newMessage: Message = {
      id: `${Date.now()}`,
      content: content,
      sender: {
        id: String(currentUser.id),
        name: currentUser.userName || '游客',
        avatar: currentUser.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
        level: currentUser.level || 1,
        points: currentUser.points || 0,
        isAdmin: currentUser.userRole === 'admin',
        region: userIpInfo?.region || '未知地区',
        country: userIpInfo?.country || '未知国家',
        avatarFramerUrl: currentUser.avatarFramerUrl,
        titleId: currentUser.titleId,
        titleIdList: currentUser.titleIdList,
      },
      timestamp: new Date(),
      quotedMessage: quotedMessage || undefined,
      mentionedUsers: mentionedUsers.length > 0 ? mentionedUsers : undefined,
      region: userIpInfo?.region || '未知地区',
      country: userIpInfo?.country || '未知国家',
    };

    // 使用全局 WebSocket 服务发送消息
    wsService.send({
      type: 2,
      userId: -1,
      data: {
        type: 'chat',
        content: {
          message: newMessage,
        },
      },
    });

    // 更新消息列表
    setMessages((prev) => [...prev, newMessage]);
    setTotal((prev) => prev + 1);
    setHasMore(true);

    // 清空输入框、预览图片、文件和引用消息
    setInputValue('');
    setPendingImageUrl(null);
    setPendingFileUrl(null);
    setQuotedMessage(null);

    // 更新最后发送时间和内容
    setLastSendTime(now);
    setLastSendContent(content);
    setLastSendContentTime(now);

    // 滚动到底部
    setTimeout(scrollToBottom, 100);
  };

  // 移除待发送的图片
  const handleRemoveImage = () => {
    setPendingImageUrl(null);
  };

  // 添加撤回消息的处理函数
  const handleRevokeMessage = (messageId: string) => {
    wsService.send({
      type: 2,
      userId: -1,
      data: {
        type: 'userMessageRevoke',
        content: messageId,
      },
    });

    messageApi.info('消息已撤回');
  };

  // 处理@输入
  const handleMentionInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = e.target.value;

    // 过滤掉 ``` 字符
    value = value.replace(/```/g, '');

    setInputValue(value);

    // 检查是否输入了#摸鱼日历
    if (value === '#摸鱼日历') {
      fetchMoyuCalendar();
      setInputValue(''); // 清空输入框，因为这是触发词
      return;
    }

    // 检查是否输入了@
    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const searchText = value.slice(lastAtPos + 1);
      setMentionSearchText(searchText);

      // 过滤在线用户，添加安全检查
      const filtered = onlineUsers.filter((user) => {
        if (!user || !user.name) return false;
        return user.name.toLowerCase().includes(searchText.toLowerCase());
      });
      setFilteredUsers(filtered);

      // 获取输入框位置
      const textarea = e.target;
      const rect = textarea.getBoundingClientRect();
      const cursorPos = textarea.selectionStart;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const lines = value.slice(0, cursorPos).split('\n');
      const currentLine = lines[lines.length - 1];
      const currentLinePos = currentLine.length;

      // 根据过滤结果数量调整位置
      const itemHeight = 40; // 每个选项的高度
      const maxItems = 3; // 最多显示3条数据时紧贴显示
      const listHeight = Math.min(filtered.length, maxItems) * itemHeight;
      const topOffset = filtered.length <= maxItems ? -listHeight : -200; // 数据较少时紧贴输入框

      setMentionListPosition({
        top: rect.top + topOffset,
        left: rect.left + currentLinePos * 8, // 8是字符的近似宽度
      });

      setIsMentionListVisible(true);
    } else {
      setIsMentionListVisible(false);
    }
  };

  // 点击空白处隐藏成员列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionListRef.current && !mentionListRef.current.contains(event.target as Node)) {
        setIsMentionListVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 选择@成员
  const handleSelectMention = (user: User) => {
    const value = inputValue;
    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1) {
      // 如果已经输入了@，则替换当前@后面的内容
      const newValue =
        value.slice(0, lastAtPos) +
        `@${user.name} ` +
        value.slice(lastAtPos + mentionSearchText.length + 1);
      setInputValue(newValue);
    } else {
      // 如果没有输入@，则在当前光标位置插入@用户名
      const cursorPos = inputRef.current?.selectionStart || 0;
      const newValue = value.slice(0, cursorPos) + `@${user.name} ` + value.slice(cursorPos);
      setInputValue(newValue);
    }
    setIsMentionListVisible(false);
    setMentionSearchText('');
    // 让输入框获得焦点
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // 添加一个生成简短唯一标识符的函数
  const generateUniqueShortId = (userId: string): string => {
    // 如果是数字ID，转换为16进制并取前4位
    if (/^\d+$/.test(userId)) {
      const hex = parseInt(userId).toString(16).toUpperCase();
      return `#${hex.padStart(4, '0').slice(0, 4)}`;
    }
    // 如果是字符串ID，取前4个字符，不足则补0
    return `#${userId.slice(0, 4).padEnd(4, '0').toUpperCase()}`;
  };

  const UserInfoCard: React.FC<{ user: User }> = ({ user }) => {
    // 从 titleIdList 字符串解析称号 ID 数组
    const userTitleIds: number[] = user.titleIdList ? JSON.parse(user.titleIdList) : [];
    const [isTitlesExpanded, setIsTitlesExpanded] = useState(false);

    // 生成用户唯一标识符
    const userShortId = generateUniqueShortId(user.id);

    // 获取所有称号
    const allTitles = [
      getAdminTag(user.isAdmin, user.level, 0),
      ...userTitleIds.map((titleId) => getAdminTag(user.isAdmin, user.level, titleId)),
    ];

    // 优先显示用户选中的称号
    const defaultTitle = user.titleId
      ? allTitles.find((titleElement) => {
          // 检查是否是管理员称号
          if (
            user.titleId === -1 &&
            titleElement.props?.children?.[1]?.props?.children === '管理员'
          ) {
            return true;
          }
          // 检查其他称号
          const titles = require('@/config/titles.json').titles;
          const titleConfig = titles.find((t: Title) => String(t.id) === String(user.titleId));
          return (
            titleConfig && titleConfig.name === titleElement.props?.children?.[1]?.props?.children
          );
        }) || allTitles[0]
      : allTitles[0];
    // 其他称号
    const otherTitles = allTitles.filter((title) => title !== defaultTitle);

    return (
      <div className={styles.userInfoCard} onMouseLeave={() => setIsTitlesExpanded(false)}>
        <div className={styles.userInfoCardHeader}>
          <div
            className={styles.avatarWrapper}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleSelectMention(user);
            }}
          >
            <Popover
              content={<div className={styles.userShortId}>{userShortId}</div>}
              trigger="hover"
              placement="bottom"
            >
              <div className={styles.avatarWithFrame}>
                <Avatar src={user.avatar} size={48} />
                {user.avatarFramerUrl && (
                  <img
                    src={user.avatarFramerUrl}
                    className={styles.avatarFrame}
                    alt="avatar-frame"
                  />
                )}
              </div>
            </Popover>
            <div className={styles.floatingFish}>🐟</div>
          </div>
          <div className={styles.userInfoCardTitle}>
            <div className={styles.userInfoCardNameRow}>
              <span className={styles.userInfoCardName}>{user.name}</span>
              <span className={styles.userInfoCardLevel}>
                <span className={styles.levelEmoji}>{getLevelEmoji(user.level)}</span>
                <span className={styles.levelText}>{user.level}</span>
              </span>
            </div>
            <div className={styles.titlesContainer}>
              {defaultTitle}
              {otherTitles.length > 0 && (
                <Popover
                  content={
                    <div className={styles.expandedTitles}>
                      {otherTitles.map((title, index) => (
                        <div key={index} className={styles.expandedTitle}>
                          {title}
                        </div>
                      ))}
                    </div>
                  }
                  trigger="click"
                  placement="right"
                  overlayClassName={styles.titlesPopover}
                  open={isTitlesExpanded}
                  onOpenChange={setIsTitlesExpanded}
                >
                  <Button
                    type="text"
                    size="small"
                    className={styles.expandButton}
                    icon={<RightOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTitlesExpanded(!isTitlesExpanded);
                    }}
                  />
                </Popover>
              )}
            </div>
            <div className={styles.userInfoCardPoints}>
              <span className={styles.pointsEmoji}>✨</span>
              <span className={styles.pointsText}>积分: {user.points || 0}</span>
            </div>
            {user.id === String(currentUser?.id)
              ? userIpInfo && (
                  <div className={styles.userInfoCardLocation}>
                    <span className={styles.locationEmoji}>📍</span>
                    <span className={styles.locationText}>
                      {userIpInfo.country} · {userIpInfo.region}
                    </span>
                  </div>
                )
              : user.region && (
                  <div className={styles.userInfoCardLocation}>
                    <span className={styles.locationEmoji}>📍</span>
                    <span className={styles.locationText}>
                      {user.country ? `${user.country} · ${user.region}` : user.region}
                    </span>
                  </div>
                )}
          </div>
        </div>
      </div>
    );
  };

  // 在 return 语句之前添加引用消息的处理函数
  const handleQuoteMessage = (message: Message) => {
    setQuotedMessage(message);
    // 让输入框获得焦点
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const getLevelEmoji = (level: number) => {
    switch (level) {
      case 7:
        return '👑'; // 最高级
      case 6:
        return '💫';
      case 5:
        return '🏖';
      case 4:
        return '🎣';
      case 3:
        return '⭐';
      case 2:
        return '🐣';
      case 1:
        return '💦';
      default:
        return '💦'; // 默认显示
    }
  };

  // 新增管理员标识函数
  const getAdminTag = (isAdmin: boolean, level: number, titleId?: number) => {
    // 如果有特定的称号ID且不是0（0表示使用等级称号）
    if (titleId !== undefined && titleId != 0) {
      // 从 titles.json 中获取对应的称号
      const titles: Title[] = require('@/config/titles.json').titles;
      const title = titles.find((t: Title) => String(t.id) === String(titleId));

      if (title) {
        let tagEmoji = '';
        let tagClass = '';

        // 根据不同的称号ID设置不同的样式
        switch (String(titleId)) {
          case '-1': // 管理员
            tagEmoji = '🚀';
            tagClass = styles.titleTagAdmin;
            break;
          case '1': // 天使投资人
            tagEmoji = '😇';
            tagClass = styles.titleTagInvestor;
            break;
          case '2': // 首席摸鱼官
            tagEmoji = '🏆';
            tagClass = styles.titleTagChief;
            break;
          case '3': // 白金摸鱼官
            tagEmoji = '💎';
            tagClass = styles.titleTagPlatinum;
            break;
          case '4': // 黄金摸鱼官
            tagEmoji = '🌟';
            tagClass = styles.titleTagGold;
            break;
          case '5': // 摸鱼共建者
            tagEmoji = '🛠️';
            tagClass = styles.titleTagBuilder;
            break;
          default:
            tagEmoji = '🎯';
            tagClass = styles.levelTagBeginner;
        }

        return (
          <span className={`${styles.adminTag} ${tagClass}`}>
            {tagEmoji}
            <span className={styles.adminText}>{title.name}</span>
          </span>
        );
      }
    }

    // 如果没有特定称号或称号ID为0，则使用原有的等级称号逻辑
    let tagText = '';
    let tagEmoji = '';
    let tagClass = '';

    switch (level) {
      case 7:
        tagText = '摸鱼皇帝';
        tagEmoji = '👑';
        tagClass = styles.levelTagMaster;
        break;
      case 6:
        tagText = '躺平宗师';
        tagEmoji = '💫';
        tagClass = styles.levelTagExpert;
        break;
      case 5:
        tagText = '摆烂大师';
        tagEmoji = '🏖️';
        tagClass = styles.levelTagPro;
        break;
      case 4:
        tagText = '摸鱼专家 ';
        tagEmoji = '🎣';
        tagClass = styles.levelTagAdvanced;
        break;
      case 3:
        tagText = '水群达人';
        tagEmoji = '⭐';
        tagClass = styles.levelTagBeginner;
        break;
      case 2:
        tagText = '摸鱼学徒';
        tagEmoji = '🐣';
        tagClass = styles.levelTagNewbie;
        break;
      default:
        tagText = '划水新秀';
        tagEmoji = '💦';
        tagClass = styles.levelTagNewbie;
    }

    return (
      <span className={`${styles.adminTag} ${tagClass}`}>
        {tagEmoji}
        <span className={styles.adminText}>{tagText}</span>
      </span>
    );
  };

  const handleEmojiClick = (emoji: any) => {
    setInputValue((prev) => prev + emoji.native);
    setIsEmojiPickerVisible(false);
    // 让输入框获得焦点
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const emojiPickerContent = (
    <div className={styles.emojiPicker}>
      <Picker
        data={data}
        i18n={zhData}
        onEmojiSelect={handleEmojiClick}
        theme="light"
        locale="zh"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );

  const handleEmoticonSelect = (url: string) => {
    // 将图片URL作为消息内容发送
    const imageMessage = `[img]${url}[/img]`;
    setInputValue(imageMessage);

    // 直接使用新的消息内容发送，而不是依赖 inputValue 的状态更新
    if (!wsService.isConnected()) {
      return;
    }

    if (!currentUser?.id) {
      messageApi.error('请先登录！');
      return;
    }

    const newMessage: Message = {
      id: `${Date.now()}`,
      content: imageMessage,
      sender: {
        id: String(currentUser.id),
        name: currentUser.userName || '游客',
        avatar: currentUser.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
        level: currentUser.level || 1,
        points: currentUser.points || 0, // 确保这里设置了积分
        isAdmin: currentUser.userRole === 'admin',
        region: userIpInfo?.region || '未知地区',
        country: userIpInfo?.country || '未知国家',
        avatarFramerUrl: currentUser.avatarFramerUrl,
        titleId: currentUser.titleId,
        titleIdList: currentUser.titleIdList,
      },
      timestamp: new Date(),
    };

    // 新发送的消息添加到列表末尾
    setMessages((prev) => [...prev, newMessage]);
    // 更新总消息数和分页状态
    setTotal((prev) => prev + 1);
    setHasMore(true);

    // 发送消息到服务器
    wsService.send({
      type: 2,
      userId: -1,
      data: {
        type: 'chat',
        content: {
          message: newMessage,
        },
      },
    });

    setInputValue('');
    setIsEmoticonPickerVisible(false);
    // 发送消息后滚动到底部
    setTimeout(scrollToBottom, 100);
  };

  // 修改 handleInviteClick 函数
  const handleInviteClick = (roomId: string, gameType: string) => {
    switch (gameType) {
      case 'chess':
        localStorage.setItem('piece_join_status', 'new');
        history.push(`/game/piece?roomId=${roomId}&mode=online`);
        break;
      case 'chineseChess':
        history.push(`/game/chineseChess?roomId=${roomId}&mode=online`);
        break;
      default:
        break;
    }
  };

  // 添加发送红包的处理函数
  const handleSendRedPacket = async () => {
    if (!currentUser?.id) {
      messageApi.error('请先登录！');
      return;
    }

    if (redPacketAmount <= 0 || redPacketCount <= 0) {
      messageApi.error('请输入有效的红包金额和数量！');
      return;
    }

    try {
      const response = await createRedPacketUsingPost({
        totalAmount: redPacketAmount,
        count: redPacketCount,
        type: redPacketType, // 使用选择的红包类型
        name: redPacketMessage,
      });

      if (response.data) {
        // 发送红包消息
        const newMessage: Message = {
          id: `${Date.now()}`,
          content: `[redpacket]${response.data}[/redpacket]`,
          sender: {
            id: String(currentUser.id),
            name: currentUser.userName || '游客',
            avatar:
              currentUser.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=visitor',
            level: currentUser.level || 1,
            points: currentUser.points || 0,
            isAdmin: currentUser.userRole === 'admin',
            region: userIpInfo?.region || '未知地区',
            country: userIpInfo?.country || '未知国家',
            avatarFramerUrl: currentUser.avatarFramerUrl,
            titleId: currentUser.titleId,
            titleIdList: currentUser.titleIdList,
          },
          timestamp: new Date(),
        };

        wsService.send({
          type: 2,
          userId: -1,
          data: {
            type: 'chat',
            content: {
              message: newMessage,
            },
          },
        });

        setMessages((prev) => [...prev, newMessage]);
        setTotal((prev) => prev + 1);
        setHasMore(true);

        messageApi.success('红包发送成功！');
        setIsRedPacketModalVisible(false);
        setRedPacketAmount(0);
        setRedPacketCount(1);
        setRedPacketMessage('恭喜发财，大吉大利！');
      }
    } catch (error) {
      messageApi.error('红包发送失败！');
    }
  };

  // 修改获取红包详情的函数
  const fetchRedPacketDetail = async (redPacketId: string) => {
    // 如果已经有缓存，直接返回
    const cachedDetail = redPacketDetailsMap.get(redPacketId);
    if (cachedDetail !== undefined) {
      return cachedDetail;
    }

    try {
      const response = await getRedPacketDetailUsingGet({ redPacketId });
      if (response.data) {
        // 更新缓存
        const detail = response.data as API.RedPacket;
        setRedPacketDetailsMap((prev) => new Map(prev).set(redPacketId, detail));
        return detail;
      }
    } catch (error) {
      console.error('获取红包详情失败:', error);
    }
    return null;
  };
  // 添加查看红包记录的处理函数
  const handleViewRedPacketRecords = async (redPacketId: string) => {
    setCurrentRedPacketId(redPacketId);
    setIsRedPacketRecordsVisible(true);
    await fetchRedPacketRecords(redPacketId);
  };
  // 修改 renderMessageContent 函数，添加红包消息的渲染

  // 添加一个全局音频引用
  const [currentMusic, setCurrentMusic] = useState<{
    name: string;
    artists: string;
    url: string;
    cover: string;
    progress: number;
    duration: number;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 添加播放控制函数
  const togglePlay = () => {
    if (!audioRef.current || !currentMusic) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 关闭音乐播放
  const closeMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentMusic(null);
    setIsPlaying(false);
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessageContent = (content: string) => {
    const musicMatch = /\[music\]([^\[\]]*)\[\/music\]/i.exec(content);
    const coverMatch = /\[cover\]([^\[\]]*)\[\/cover\]/i.exec(content);
    if (musicMatch) {
      const musicUrl = musicMatch[1];
      const coverUrl = coverMatch ? coverMatch[1] : '';
      const musicInfo = content.split('[music]')[0];
      return (
        <div className={styles.musicMessage}>
          <div className={styles.musicWrapper}>
            {coverUrl && <img src={coverUrl} alt="album cover" className={styles.musicCover} />}
            <div className={styles.musicContent}>
              <div className={styles.musicInfo}>{musicInfo}</div>
              <audio
                controls
                src={musicUrl}
                style={{ width: '100%', minWidth: '300px' }}
                onPlay={(e) => {
                  // 停止当前正在播放的音频
                  if (audioRef.current && audioRef.current !== e.currentTarget) {
                    audioRef.current.pause();
                  }
                  const audio = e.currentTarget;
                  audioRef.current = audio;
                  setCurrentMusic({
                    name: musicInfo.split(' - ')[0].replace('🎵 ', ''),
                    artists: musicInfo.split(' - ')[1],
                    url: musicUrl,
                    cover: coverUrl,
                    progress: 0,
                    duration: audio.duration,
                  });
                  setIsPlaying(true);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                }}
              />
            </div>
          </div>
        </div>
      );
    }
    // 检查是否是红包消息
    // const redPacketMatch = content.match(/\[redpacket\](.*?)\[\/redpacket\]/);
    const redPacketMatch = /\[redpacket\]([^\[\]]*)\[\/redpacket\]/i.exec(content);
    if (redPacketMatch) {
      const redPacketId = redPacketMatch[1];
      const detail = redPacketDetailsMap.get(redPacketId);

      // 如果没有缓存，则获取详情
      if (!detail) {
        fetchRedPacketDetail(redPacketId);
      }

      return (
        <div className={styles.redPacketMessage}>
          <div className={styles.redPacketContent}>
            <GiftOutlined className={styles.redPacketIcon} />
            <div className={styles.redPacketInfo}>
              <div className={styles.redPacketTitle}>
                <span className={styles.redPacketText}>{detail?.name || '红包'}</span>
                <span className={styles.redPacketStatus}>
                  {detail?.remainingCount === 0
                    ? '（已抢完）'
                    : detail?.status === 2
                    ? '（已过期）'
                    : `（剩余${detail?.remainingCount || 0}个）`}
                </span>
              </div>
              <div className={styles.redPacketActions}>
                <Button
                  type="primary"
                  size="small"
                  onClick={async () => {
                    try {
                      const response = await grabRedPacketUsingPost({
                        redPacketId: redPacketId,
                      });
                      if (response.data) {
                        messageApi.success(`恭喜你抢到 ${response.data} 积分！`);
                        // 刷新红包记录和详情
                        await Promise.all([
                          fetchRedPacketRecords(redPacketId),
                          fetchRedPacketDetail(redPacketId),
                        ]);
                      }
                    } catch (error) {
                      messageApi.error('红包已被抢完或已过期！');
                    }
                  }}
                  className={styles.grabRedPacketButton}
                  disabled={detail?.remainingCount === 0 || detail?.status === 2}
                >
                  抢红包
                </Button>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleViewRedPacketRecords(redPacketId)}
                  className={styles.viewRecordsButton}
                >
                  查看记录
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 检查是否是邀请消息
    // const inviteMatch = content.match(/\[invite\/(\w+)\](\d+)\[\/invite\]/);
    const inviteMatch = /\[invite\/([a-zA-Z0-9_]+)\]([0-9]+)\[\/invite\]/i.exec(content);
    if (inviteMatch) {
      const roomId = inviteMatch[2];
      const gameType = inviteMatch[1];
      let game = '';
      switch (gameType) {
        case 'chess':
          game = '五子棋';
          break;
        case 'chineseChess':
          game = '中国象棋';
          break;
      }
      return (
        <div className={styles.inviteMessage}>
          <div className={styles.inviteContent}>
            <span className={styles.inviteText}>🎮 {game}对战邀请</span>
            <Button
              type="primary"
              size="small"
              onClick={() => handleInviteClick(roomId, gameType)}
              className={styles.inviteButton}
            >
              加入对战
            </Button>
          </div>
        </div>
      );
    }
    // const imgMatch = content.match(/\[img\](.*?)\[\/img\]/);
    const imgMatch = /\[img\]([^\[\]]*)\[\/img\]/i.exec(content);
    if (imgMatch) {
      return (
        <MessageContent
          content={content}
          onImageLoad={() => {
            // 图片加载完成后,如果是最新消息则滚动到底部
            const lastMessage = messages[messages.length - 1];
            const isLatestMessage = lastMessage?.content === content;
            if (
              isLatestMessage &&
              (isNearBottom || lastMessage?.sender.id === String(currentUser?.id))
            ) {
              scrollToBottom();
            }
          }}
        />
      );
    }
    return <MessageContent content={content} />;
  };

  // 修改获取红包记录的函数
  const fetchRedPacketRecords = async (redPacketId: string) => {
    try {
      const response = await getRedPacketRecordsUsingGet({ redPacketId });
      if (response.data) {
        // 按金额降序排序
        const sortedRecords = [...response.data].sort((a, b) => (b.amount || 0) - (a.amount || 0));
        setRedPacketRecords(sortedRecords);
      }
    } catch (error) {
      messageApi.error('获取红包记录失败！');
    }
  };

  // 在组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (newMessageTimerRef.current) {
        clearTimeout(newMessageTimerRef.current);
      }
    };
  }, []);

  // 修改获取摸鱼日历的函数
  const fetchMoyuCalendar = async () => {
    try {
      setIsLoadingMoyu(true);
      const response = await fetch('https://api.vvhan.com/api/moyu?type=json');
      const data = await response.json();
      if (data.success) {
        setPendingImageUrl(data.url);
      } else {
        messageApi.error('获取摸鱼日历失败');
      }
    } catch (error) {
      messageApi.error('获取摸鱼日历失败');
    } finally {
      setIsLoadingMoyu(false);
    }
  };

  // 添加歌单相关状态
  const [activeTab, setActiveTab] = useState('search');
  const [playlist, setPlaylist] = useState<Song[]>([]);
  // 移除未使用的状态
  const aPlayerContainerRef = useRef<HTMLDivElement>(null);
  const aPlayerInstanceRef = useRef<any>(null);

  // 添加歌单功能相关的副作用
  useEffect(() => {
    // 从localStorage加载歌单
    const savedPlaylist = localStorage.getItem('music_playlist');
    if (savedPlaylist) {
      try {
        setPlaylist(JSON.parse(savedPlaylist));
      } catch (error) {
        console.error('加载歌单失败:', error);
      }
    }

    // 加载APlayer依赖
    const loadAPlayerDependencies = () => {
      // 检查是否已加载
      if (document.getElementById('aplayer-css') || document.getElementById('aplayer-js')) {
        return;
      }

      // 加载APlayer CSS
      const link = document.createElement('link');
      link.id = 'aplayer-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css';
      document.head.appendChild(link);

      // 加载APlayer JS
      const script = document.createElement('script');
      script.id = 'aplayer-js';
      script.src = 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js';
      script.async = true;
      document.body.appendChild(script);
    };

    loadAPlayerDependencies();

    return () => {
      // 清理APlayer实例
      if (aPlayerInstanceRef.current) {
        aPlayerInstanceRef.current.destroy();
        aPlayerInstanceRef.current = null;
      }
    };
  }, []);

  // 添加歌曲到歌单
  const addToPlaylist = async (music: any) => {
    try {
      const response = await fetch('https://api.kxzjoker.cn/api/163_music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({
          url: music.id,
          level: 'lossless',
          type: 'json',
        }).toString(),
      });

      const data = await response.json();
      if (data.url) {
        const newSong: Song = {
          id: music.id,
          name: music.name,
          artist: music.artists.map((a: any) => a.name).join(','),
          url: data.url,
          cover: data.pic,
          album: music.album.name,
        };

        setPlaylist((prev) => {
          // 检查是否已存在
          if (prev.some((song) => song.id === newSong.id)) {
            messageApi.info('歌曲已在歌单中');
            return prev;
          }

          const updatedPlaylist = [...prev, newSong];
          // 保存到localStorage
          localStorage.setItem('music_playlist', JSON.stringify(updatedPlaylist));
          messageApi.success('已添加到歌单');
          return updatedPlaylist;
        });
      }
    } catch (error) {
      messageApi.error('添加歌曲失败');
    }
  };

  // 播放歌单中的歌曲
  const playFromPlaylist = (song: Song) => {
    // 确保APlayer已加载
    if (typeof window.APlayer === 'undefined') {
      messageApi.error('播放器加载中，请稍后再试');
      return;
    }

    // 初始化APlayer（如果还没有实例）
    if (!aPlayerInstanceRef.current && aPlayerContainerRef.current) {
      aPlayerInstanceRef.current = new window.APlayer({
        container: aPlayerContainerRef.current,
        audio: [song],
        autoplay: true,
        theme: '#41b883',
        listFolded: false,
        listMaxHeight: '200px',
      });
    } else if (aPlayerInstanceRef.current) {
      // 如果已有实例，直接添加并播放歌曲
      aPlayerInstanceRef.current.list.add(song);
      // 找到歌曲在列表中的索引
      const index = aPlayerInstanceRef.current.list.audios.findIndex(
        (audio: any) => audio.id === song.id,
      );
      if (index !== -1) {
        aPlayerInstanceRef.current.list.switch(index);
        aPlayerInstanceRef.current.play();
      }
    }
  };

  // 播放整个歌单
  const playEntirePlaylist = () => {
    if (playlist.length === 0) {
      messageApi.info('歌单为空');
      return;
    }

    // 确保APlayer已加载
    if (typeof window.APlayer === 'undefined') {
      messageApi.error('播放器加载中，请稍后再试');
      return;
    }

    // 销毁旧的播放器实例
    if (aPlayerInstanceRef.current) {
      aPlayerInstanceRef.current.destroy();
    }

    // 创建新的播放器实例，包含整个歌单
    if (aPlayerContainerRef.current) {
      aPlayerInstanceRef.current = new window.APlayer({
        container: aPlayerContainerRef.current,
        audio: playlist,
        autoplay: true,
        theme: '#41b883',
        listFolded: false,
        listMaxHeight: '200px',
      });
    }
  };

  // 从歌单中移除歌曲
  const removeFromPlaylist = (songId: string) => {
    setPlaylist((prev) => {
      const updatedPlaylist = prev.filter((song) => song.id !== songId);
      localStorage.setItem('music_playlist', JSON.stringify(updatedPlaylist));
      return updatedPlaylist;
    });

    // 如果当前正在播放的歌曲被移除，需要处理播放器
    if (aPlayerInstanceRef.current) {
      const currentIndex = aPlayerInstanceRef.current.list.index;
      const currentAudio = aPlayerInstanceRef.current.list.audios[currentIndex];

      if (currentAudio && currentAudio.id === songId) {
        // 如果还有下一首歌，切换到下一首，否则停止播放
        if (aPlayerInstanceRef.current.list.audios.length > 1) {
          aPlayerInstanceRef.current.skipForward();
        } else {
          aPlayerInstanceRef.current.pause();
        }
      }

      // 从播放器列表中移除
      const audioIndex = aPlayerInstanceRef.current.list.audios.findIndex(
        (audio: any) => audio.id === songId,
      );
      if (audioIndex !== -1) {
        aPlayerInstanceRef.current.list.remove(audioIndex);
      }
    }
  };

  return (
    <div className={styles.chatRoom}>
      {currentMusic && (
        <div className={styles.musicFloatingPlayer}>
          <img src={currentMusic.cover} alt="cover" className={styles.musicCover} />
          <div className={styles.musicInfo}>
            <div className={styles.musicTitle}>{currentMusic.name}</div>
            <div className={styles.musicArtist}>{currentMusic.artists}</div>
            {/* <div className={styles.progressBar}>
              <div
                className={styles.progress}
                style={{ width: `${(currentMusic.progress / currentMusic.duration) * 100}%` }}
              />
            </div> */}
            {/* <div className={styles.timeInfo}>
              {formatTime(currentMusic.progress)} / {formatTime(currentMusic.duration)}
            </div> */}
          </div>
          <div className={styles.controls}>
            <Button
              type="text"
              icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlay}
            />
            <Button type="text" icon={<CloseOutlined />} onClick={closeMusic} />
          </div>
        </div>
      )}
      {contextHolder}
      {showAnnouncement && (
        <Alert
          message={
            <div className={styles.announcementContent}>
              <SoundOutlined className={styles.announcementIcon} />
              <span dangerouslySetInnerHTML={{ __html: announcement }} />
            </div>
          }
          type="info"
          showIcon={false}
          closable
          onClose={() => setShowAnnouncement(false)}
          className={styles.announcement}
        />
      )}
      <div className={styles['floating-fish'] + ' ' + styles.fish1}>🐟</div>
      <div className={styles['floating-fish'] + ' ' + styles.fish2}>🐠</div>
      <div className={styles['floating-fish'] + ' ' + styles.fish3}>🐡</div>
      <div className={styles['floating-fish'] + ' ' + styles.bubble1}>💭</div>
      <div className={styles['floating-fish'] + ' ' + styles.bubble2}>💭</div>
      <div className={styles.messageContainer} ref={messageContainerRef} onScroll={handleScroll}>
        {loading && (
          <div className={styles.loadingWrapper}>
            <Spin />
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            id={`message-${msg.id}`}
            className={`${styles.messageItem} ${
              currentUser?.id && String(msg.sender.id) === String(currentUser.id) ? styles.self : ''
            } ${notifications.some((n) => n.id === msg.id) ? styles.mentioned : ''}`}
          >
            <div className={styles.messageHeader}>
              <div
                className={styles.avatar}
                onClick={() => handleSelectMention(msg.sender)}
                style={{ cursor: 'pointer' }}
              >
                <Popover
                  content={<UserInfoCard user={msg.sender} />}
                  trigger="hover"
                  placement="top"
                >
                  <div className={styles.avatarWithFrame}>
                    <Avatar src={msg.sender.avatar} size={32} />
                    {msg.sender.avatarFramerUrl && (
                      <img
                        src={msg.sender.avatarFramerUrl}
                        className={styles.avatarFrame}
                        alt="avatar-frame"
                      />
                    )}
                  </div>
                </Popover>
              </div>
              <div className={styles.senderInfo}>
                <span className={styles.senderName}>
                  {msg.sender.name}
                  {getAdminTag(msg.sender.isAdmin, msg.sender.level, msg.sender.titleId)}
                  <span className={styles.levelBadge}>
                    {getLevelEmoji(msg.sender.level)} {msg.sender.level}
                  </span>
                </span>
              </div>
            </div>
            <div className={styles.messageContent}>
              {msg.quotedMessage && (
                <div className={styles.quotedMessage}>
                  <div className={styles.quotedMessageHeader}>
                    <span className={styles.quotedMessageSender}>
                      {msg.quotedMessage.sender.name}
                    </span>
                    <span className={styles.quotedMessageTime}>
                      {new Date(msg.quotedMessage.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={styles.quotedMessageContent}>
                    {renderMessageContent(msg.quotedMessage.content)}
                  </div>
                </div>
              )}
              {renderMessageContent(msg.content)}
            </div>
            <div className={styles.messageFooter}>
              <span className={styles.timestamp}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
              {(currentUser?.id && String(msg.sender.id) === String(currentUser.id)) ||
              currentUser?.userRole === 'admin' ? (
                <Popconfirm
                  title="确定要撤回这条消息吗？"
                  onConfirm={() => handleRevokeMessage(msg.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <span className={styles.revokeText}>撤回</span>
                </Popconfirm>
              ) : null}
              <span className={styles.quoteText} onClick={() => handleQuoteMessage(msg)}>
                引用
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.userList}>
        <div className={styles.userListHeader}>在线成员 ({onlineUsers.length})</div>
        <div className={styles.userListContent} ref={userListRef}>
          <List
            height={listHeight}
            itemCount={onlineUsers.length}
            itemSize={USER_ITEM_HEIGHT}
            width="100%"
          >
            {UserItem}
          </List>
        </div>
      </div>

      <div className={styles.inputArea}>
        {quotedMessage && (
          <div className={styles.quotePreview}>
            <div className={styles.quotePreviewContent}>
              <span className={styles.quotePreviewSender}>{quotedMessage.sender.name}:</span>
              <span className={styles.quotePreviewText}>
                {renderMessageContent(quotedMessage.content)}
              </span>
            </div>
            <Button
              type="text"
              icon={<DeleteOutlined />}
              className={styles.removeQuote}
              onClick={handleCancelQuote}
            />
          </div>
        )}
        {pendingImageUrl && (
          <div className={styles.imagePreview}>
            <div className={styles.previewWrapper}>
              <img
                src={pendingImageUrl}
                alt="预览图片"
                className={styles.previewImage}
                onClick={() => {
                  setPreviewImage(pendingImageUrl);
                  setIsPreviewVisible(true);
                }}
              />
              <Button
                type="text"
                icon={<DeleteOutlined />}
                className={styles.removeImage}
                onClick={handleRemoveImage}
              />
            </div>
          </div>
        )}
        {pendingFileUrl && (
          <div className={styles.filePreview}>
            <div className={styles.previewWrapper}>
              <div className={styles.fileInfo}>
                <PaperClipOutlined className={styles.fileIcon} />
                <span className={styles.fileName}>{pendingFileUrl.split('/').pop()}</span>
              </div>
              <Button
                type="text"
                icon={<DeleteOutlined />}
                className={styles.removeFile}
                onClick={handleRemoveFile}
              />
            </div>
          </div>
        )}
        <div className={styles.inputRow}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // 检查文件类型
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                  messageApi.error('只支持 JPG、PNG、GIF 和 WEBP 格式的图片');
                  return;
                }
                // 检查文件大小（限制为 5MB）
                if (file.size > 5 * 1024 * 1024) {
                  messageApi.error('图片大小不能超过 5MB');
                  return;
                }
                handleImageUpload(file);
              }
            }}
            accept="image/jpeg,image/png,image/gif,image/webp"
            disabled={uploading}
          />
          <Popover
            content={emojiPickerContent}
            trigger="click"
            visible={isEmojiPickerVisible}
            onVisibleChange={setIsEmojiPickerVisible}
            placement="topLeft"
            overlayClassName={styles.emojiPopover}
          >
            <Button icon={<SmileOutlined />} className={styles.emojiButton} />
          </Popover>
          <Popover
            content={<EmoticonPicker onSelect={handleEmoticonSelect} />}
            trigger="click"
            visible={isEmoticonPickerVisible}
            onVisibleChange={setIsEmoticonPickerVisible}
            placement="topLeft"
            overlayClassName={styles.emoticonPopover}
          >
            <Button icon={<PictureOutlined />} className={styles.emoticonButton} />
          </Popover>
          <Button
            icon={<CustomerServiceOutlined />}
            className={styles.musicButton}
            onClick={() => setIsMusicSearchVisible(true)}
          />
          {currentUser?.userRole === 'admin' && (
            <Button
              icon={<GiftOutlined />}
              className={styles.redPacketButton}
              onClick={() => setIsRedPacketModalVisible(true)}
            />
          )}
          {/* 添加手机端图片上传按钮 */}
          <Button
            icon={<UploadOutlined />}
            className={styles.imageUploadButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          />
          <Input.TextArea
            ref={inputRef}
            value={inputValue}
            onChange={handleMentionInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.nativeEvent.isComposing) {
                  return;
                }
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }
            }}
            onPaste={handlePaste}
            placeholder={uploading ? '正在上传图片...' : '输入消息或粘贴图片...'}
            maxLength={200}
            disabled={uploading}
            autoSize={{ minRows: 1, maxRows: 4 }}
            className={`${styles.chatTextArea} ${styles.hidePlaceholderOnMobile}`}
          />
          {isMentionListVisible && filteredUsers.length > 0 && (
            <div
              ref={mentionListRef}
              className={styles.mentionList}
              style={{
                position: 'fixed',
                top: mentionListPosition.top,
                left: mentionListPosition.left,
                zIndex: 1000,
              }}
            >
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={styles.mentionItem}
                  onClick={() => handleSelectMention(user)}
                >
                  <Avatar src={user.avatar} size={24} />
                  <span className={styles.mentionName}>{user.name}</span>
                </div>
              ))}
            </div>
          )}
          <span className={styles.inputCounter}>{inputValue.length}/200</span>
          <Button
            type="text"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            disabled={uploading}
            className={styles.sendButton}
          >
            发送
          </Button>
        </div>
      </div>
      <Modal
        title={
          <div className={styles.redPacketModalTitle}>
            <GiftOutlined className={styles.redPacketTitleIcon} />
            <span>发送红包</span>
          </div>
        }
        open={isRedPacketModalVisible}
        onOk={handleSendRedPacket}
        onCancel={() => setIsRedPacketModalVisible(false)}
        okText="发送"
        cancelText="取消"
        width={400}
        className={styles.redPacketModal}
      >
        <div className={styles.redPacketForm}>
          <div className={styles.formItem}>
            <span className={styles.label}>红包类型：</span>
            <Radio.Group
              value={redPacketType}
              onChange={(e) => setRedPacketType(e.target.value)}
              className={styles.redPacketTypeGroup}
            >
              <Radio.Button value={1}>
                <span className={styles.typeIcon}>🎲</span>
                <span>随机红包</span>
              </Radio.Button>
              <Radio.Button value={2}>
                <span className={styles.typeIcon}>📊</span>
                <span>平均红包</span>
              </Radio.Button>
            </Radio.Group>
          </div>
          <div className={styles.formItem}>
            <span className={styles.label}>红包金额：</span>
            <Input
              type="number"
              value={redPacketAmount}
              onChange={(e) => setRedPacketAmount(Number(e.target.value))}
              min={1}
              placeholder="请输入红包金额"
              prefix="¥"
              className={styles.amountInput}
            />
          </div>
          <div className={styles.formItem}>
            <span className={styles.label}>红包个数：</span>
            <Input
              type="number"
              value={redPacketCount}
              onChange={(e) => setRedPacketCount(Number(e.target.value))}
              min={1}
              placeholder="请输入红包个数"
              className={styles.countInput}
            />
          </div>
          <div className={styles.formItem}>
            <span className={styles.label}>祝福语：</span>
            <Input.TextArea
              value={redPacketMessage}
              onChange={(e) => setRedPacketMessage(e.target.value)}
              placeholder="恭喜发财，大吉大利！"
              maxLength={50}
              showCount
              className={styles.messageInput}
            />
          </div>
        </div>
      </Modal>

      <Modal open={isPreviewVisible} footer={null} onCancel={() => setIsPreviewVisible(false)}>
        {previewImage && <img alt="预览" style={{ width: '100%' }} src={previewImage} />}
      </Modal>

      <Modal
        title="红包记录"
        open={isRedPacketRecordsVisible}
        onCancel={() => setIsRedPacketRecordsVisible(false)}
        footer={null}
        width={400}
      >
        <div className={styles.redPacketRecords}>
          <div className={styles.recordsList}>
            {redPacketRecords.length > 0 ? (
              redPacketRecords.map((record, index) => (
                <div key={record.id} className={styles.recordItem}>
                  <Avatar src={record.userAvatar} size={32} />
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>
                      {record.userName}
                      {index === 0 && <span className={styles.luckyKing}>👑 手气王</span>}
                    </div>
                    <div className={styles.grabTime}>
                      {new Date(record.grabTime || '').toLocaleString()}
                    </div>
                  </div>
                  <div className={styles.amount}>{record.amount} 积分</div>
                </div>
              ))
            ) : (
              <div className={styles.emptyRecords}>
                <GiftOutlined className={styles.emptyIcon} />
                <span>暂无人抢到红包</span>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal
        title="点歌"
        open={isMusicSearchVisible}
        onCancel={() => setIsMusicSearchVisible(false)}
        footer={null}
        width={600}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'search',
              label: '搜索音乐',
              children: (
                <div className={styles.musicSearch}>
                  <Input.Search
                    placeholder="输入歌曲名称"
                    value={searchKey}
                    onChange={(e) => setSearchKey(e.target.value)}
                    onSearch={handleMusicSearch}
                    enterButton
                    style={{ marginBottom: '10px' }}
                  />
                  <List
                    className={styles.musicList}
                    height={300}
                    itemCount={searchResults.length}
                    itemSize={60}
                    width="100%"
                  >
                    {({ index, style }) => {
                      const item = searchResults[index];
                      return (
                        <div
                          style={{
                            ...style,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '5px 10px',
                          }}
                          className={styles.musicListItem}
                        >
                          <div className={styles.musicInfo}>
                            <div className={styles.musicTitle}>{item.name}</div>
                            <div className={styles.musicDesc}>
                              {`${item.artists.map((a: any) => a.name).join(',')} - ${
                                item.album.name
                              }`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => handleSelectMusic(item)}
                            >
                              发送
                            </Button>
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => addToPlaylist(item)}
                            >
                              添加到歌单
                            </Button>
                          </div>
                        </div>
                      );
                    }}
                  </List>
                </div>
              ),
            },
            {
              key: 'playlist',
              label: '我的歌单',
              children: (
                <div className={styles.playlist}>
                  <div
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>共 {playlist.length} 首歌曲</div>
                    {playlist.length > 0 && (
                      <Button type="primary" size="small" onClick={playEntirePlaylist}>
                        播放全部
                      </Button>
                    )}
                  </div>

                  {playlist.length === 0 ? (
                    <Empty description="你的歌单还是空的" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <div
                      className={styles.playlistContainer}
                      style={{ maxHeight: '250px', overflow: 'auto' }}
                    >
                      {playlist.map((song) => (
                        <div
                          key={song.id}
                          className={styles.playlistItem}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px',
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          <img
                            src={song.cover}
                            alt={song.name}
                            style={{
                              width: '40px',
                              height: '40px',
                              marginRight: '10px',
                              borderRadius: '4px',
                            }}
                          />
                          <div className={styles.songInfo} style={{ flex: 1 }}>
                            <div>{song.name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>{song.artist}</div>
                          </div>
                          <div className={styles.songActions}>
                            <Button
                              type="text"
                              size="small"
                              icon={<PlayCircleOutlined />}
                              onClick={() => playFromPlaylist(song)}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeFromPlaylist(song.id)}
                              danger
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* APlayer容器 */}
                  <div ref={aPlayerContainerRef} style={{ marginTop: '20px' }} />
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

// @ts-ignore
export default ChatRoom;
