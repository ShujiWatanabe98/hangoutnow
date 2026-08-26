(() => {
  const day = offset => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const dayLabel = offset => {
    const date = new Date(`${day(offset)}T12:00:00`);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  window.OYANOTE_DEMOS = {
    demo1: {
      label: 'デモ1',
      theme: 'green',
      mother: {
        name: '青木 和子', firstName: '和子', age: 76, careLevel: '要介護2',
        diagnosis: '脳梗塞後・右片麻痺', sinceDischarge: '退院8か月', living: '長女と同居',
        hospital: '緑丘リハビリテーション病院', facility: 'デイケア陽だまり桜台',
        goal: '自分の足で近所の喫茶店へ行く', photo: './personas/demo1-aoki-kazuko.png',
        story: '右手足に軽い麻痺が残るものの、杖で屋内を歩いています。週3回のデイケアと家族の見守りを組み合わせ、買い物と外出を少しずつ再開しています。'
      },
      schedules: [
        { time: '09:00', tag: 'デイケア', title: 'デイケア陽だまり桜台', note: '送迎 9:00 ／ 帰宅 16:10', owner: '美咲', type: 'care' },
        { time: '18:30', tag: '家族の予定', title: '夕食後の自主練習を確認', note: '廊下歩行と右手の課題を10分', owner: '直人', type: 'family' }
      ],
      motherUpdates: [
        { id: 1101, text: '朝食後、杖で玄関まで安定して歩けました。', createdDay: day(0), time: '8:05' }
      ],
      timeline: [
        { icon: '👩', title: '長女・美咲さん', text: '今朝の薬ケースを確認しました。今日は私がデイケアの帰宅時間に在宅します。', date: dayLabel(0), time: '8:20' },
        { icon: '👨', title: '長男・直人さん', text: '土曜日は一緒に近所の喫茶店まで歩く練習をします。', date: dayLabel(-1), time: '20:10' }
      ],
      incomingShares: [
        { source: 'hospital', icon: '📋', title: 'リハシステム連携（デモ）・退院時サマリ', text: '退院時FIMは運動72/91点、認知32/35点。食事と整容は自立、入浴と屋外歩行は見守りが必要という架空の評価設定です。', date: dayLabel(-10), time: '10:00' },
        { source: 'hospital', icon: '📈', title: 'リハシステム連携（デモ）・最終リハビリ評価', text: 'BBS 42/56点、10m快適歩行15.8秒（T字杖）の架空データ。疲労時に右足の振り出しが小さくなる傾向を共有しています。', date: dayLabel(-9), time: '14:30' },
        { source: 'hospital', icon: '🎯', title: 'リハシステム連携（デモ）・在宅での継続目標', text: '玄関から近所の喫茶店まで、途中で休憩しながら家族の見守りで歩くことを長期目標として共有しています。', date: dayLabel(-8), time: '11:15' },
        { source: 'hospital', icon: '🏥', title: '緑丘リハビリテーション病院・山岸PT', text: '疲れが出ると右足がすりやすいため、外出は途中で休める場所を決めて続けてください。', date: dayLabel(-2), time: '15:40' },
        { source: 'care', icon: '🌿', title: 'デイケア陽だまり桜台・中村介護職', text: '浴室のまたぎ動作が安定しました。午後は歩行練習後も笑顔で過ごされました。', date: dayLabel(-1), time: '16:25' }
      ],
      members: [
        { id: 1101, type: 'family', name: '青木 美咲', role: '管理者・長女', contact: '', note: '同居・平日の連絡担当' },
        { id: 1102, type: 'family', name: '青木 直人', role: '長男', contact: '', note: '土日の外出を担当' },
        { id: 1103, type: 'hospital', name: '黒田 崇', role: 'リハビリテーション科医', contact: '', note: '緑丘リハビリテーション病院' },
        { id: 1104, type: 'hospital', name: '山岸 麻衣', role: '理学療法士', contact: '', note: '緑丘リハビリテーション病院' },
        { id: 1105, type: 'care', name: '佐藤 恵', role: 'ケアマネジャー', contact: '', note: '梅の木居宅介護支援' },
        { id: 1106, type: 'care', name: '中村 千紘', role: '介護職', contact: '', note: 'デイケア陽だまり桜台' }
      ],
      events: [
        { id: 1101, type: 'care', title: 'デイケア陽だまり桜台', date: day(0), time: '09:00', owner: '美咲', note: '歩行・入浴' },
        { id: 1102, type: 'family', title: '自主練習の確認', date: day(0), time: '18:30', owner: '直人', note: '廊下歩行10分' },
        { id: 1103, type: 'hospital', title: '退院後外来', date: day(3), time: '10:30', owner: '美咲', note: '緑丘リハビリテーション病院' }
      ],
      shopping: [
        { id: 1101, name: '杖先ゴム', detail: '予備1個', owner: '直人', done: false },
        { id: 1102, name: '滑り止め付き靴下', detail: '室内用・2足', owner: '美咲', done: false },
        { id: 1103, name: '麦茶', detail: 'ノンカフェイン', owner: '美咲', done: true },
        { id: 1104, name: '連絡ノート用ファイル', detail: 'A5サイズ', owner: '直人', done: true }
      ],
      selectedDate: day(0), calendarMonth: day(0).slice(0, 7)
    },
    demo2: {
      label: 'デモ2',
      theme: 'blue',
      mother: {
        name: '吉田 修', firstName: '修', age: 68, careLevel: '要介護1',
        diagnosis: '脳出血後・軽度失語症', sinceDischarge: '退院1年2か月', living: '妻と二人暮らし',
        hospital: '東京みらい脳神経リハビリ病院', facility: '通所リハビリ青葉テラス',
        goal: '孫と会話しながら将棋を指す', photo: './personas/demo2-yoshida-osamu.png',
        story: '言葉が出るまで少し時間がかかりますが、短い会話とメモを使えば意思を伝えられます。妻と暮らし、週2回の通所リハビリで会話と右手の練習を続けています。'
      },
      schedules: [
        { time: '10:00', tag: '通所リハ', title: '通所リハビリ青葉テラス', note: '言語訓練と右手の作業練習', owner: '恵子', type: 'care' },
        { time: '19:00', tag: '家族の予定', title: '孫とオンライン将棋', note: '返答を急がず、写真カードも使用', owner: '彩', type: 'family' }
      ],
      motherUpdates: [
        { id: 2101, text: '朝、自分から「今日は青葉」と予定を確認できました。', createdDay: day(0), time: '7:50' }
      ],
      timeline: [
        { icon: '👩', title: '妻・恵子さん', text: '朝の会話はゆっくり待つと、ご本人の言葉で最後まで話せました。', date: dayLabel(0), time: '8:15' },
        { icon: '👧', title: '長女・彩さん', text: '今夜の将棋は19時から。孫にも返事を待つことを伝えています。', date: dayLabel(0), time: '9:05' }
      ],
      incomingShares: [
        { source: 'hospital', icon: '📋', title: 'リハシステム連携（デモ）・退院時サマリ', text: '退院時FIMは運動84/91点、認知27/35点。移動と身の回り動作は概ね自立し、複雑な会話では待つ支援が必要という架空の評価設定です。', date: dayLabel(-12), time: '9:45' },
        { source: 'hospital', icon: '🗣️', title: 'リハシステム連携（デモ）・言語評価', text: 'SLTAでは短文理解は安定。呼称と自発話は言葉が出るまで時間を要するため、質問を一つずつ提示するという架空の評価設定です。', date: dayLabel(-11), time: '13:20' },
        { source: 'hospital', icon: '🎯', title: 'リハシステム連携（デモ）・在宅での継続目標', text: '買い物メモを使って用件を伝えることと、孫との将棋で本人の返答を待ちながら会話を続けることを共有しています。', date: dayLabel(-10), time: '15:10' },
        { source: 'hospital', icon: '🏥', title: '東京みらい脳神経リハビリ病院・神谷ST', text: '言葉を先回りせず、質問は一度に一つにすると修さん自身の発話が増えています。', date: dayLabel(-3), time: '14:10' },
        { source: 'care', icon: '🗣️', title: '通所リハビリ青葉テラス・奥田OT', text: '買い物場面の練習で、品名をメモして店員へ見せる方法を自分から使えました。', date: dayLabel(-1), time: '16:40' }
      ],
      members: [
        { id: 2101, type: 'family', name: '吉田 恵子', role: '管理者・妻', contact: '', note: '同居・毎日の体調確認' },
        { id: 2102, type: 'family', name: '吉田 彩', role: '長女', contact: '', note: '週3回オンラインで会話' },
        { id: 2103, type: 'hospital', name: '村瀬 和也', role: '脳神経内科医', contact: '', note: '東京みらい脳神経リハビリ病院' },
        { id: 2104, type: 'hospital', name: '神谷 友紀', role: '言語聴覚士', contact: '', note: '東京みらい脳神経リハビリ病院' },
        { id: 2105, type: 'care', name: '小林 秀子', role: 'ケアマネジャー', contact: '', note: '青葉ケアプランセンター' },
        { id: 2106, type: 'care', name: '奥田 翔太', role: '作業療法士', contact: '', note: '通所リハビリ青葉テラス' }
      ],
      events: [
        { id: 2101, type: 'care', title: '通所リハビリ青葉テラス', date: day(0), time: '10:00', owner: '恵子', note: '言語・作業療法' },
        { id: 2102, type: 'family', title: '孫とオンライン将棋', date: day(0), time: '19:00', owner: '彩', note: '30分程度' },
        { id: 2103, type: 'hospital', title: '言語外来', date: day(5), time: '13:30', owner: '恵子', note: '東京みらい脳神経リハビリ病院' }
      ],
      shopping: [
        { id: 2101, name: '太字のメモ帳', detail: '会話・買い物用', owner: '彩', done: false },
        { id: 2102, name: '水性ペン', detail: '黒・太字', owner: '恵子', done: true },
        { id: 2103, name: '将棋盤用の滑り止め', detail: '薄型', owner: '彩', done: false },
        { id: 2104, name: 'ヨーグルト', detail: '無糖・4個', owner: '恵子', done: true }
      ],
      selectedDate: day(0), calendarMonth: day(0).slice(0, 7)
    },
    demo3: {
      label: 'デモ3',
      theme: 'plum',
      mother: {
        name: '藤本 千代', firstName: '千代', age: 83, careLevel: '要介護2',
        diagnosis: '脳梗塞後・バランス低下', sinceDischarge: '退院5か月', living: '長男家族と同居',
        hospital: '彩北リハビリテーション病院', facility: 'ケアホーム結の庭',
        goal: '庭の鉢植えの世話を続ける', photo: './personas/demo3-fujimoto-chiyo.png',
        story: '立ち上がりと方向転換に見守りが必要で、疲れるとふらつきが増えます。家族と施設が活動量を共有し、好きな鉢植えの世話を安全に続けることを目標にしています。'
      },
      schedules: [
        { time: '09:30', tag: 'デイサービス', title: 'ケアホーム結の庭', note: '入浴と集団体操 ／ 帰宅 15:45', owner: '奈緒', type: 'care' },
        { time: '16:30', tag: '家族の予定', title: '鉢植えの水やり', note: '椅子に座って10分、孫が付き添い', owner: '杏', type: 'family' }
      ],
      motherUpdates: [
        { id: 3101, text: '昨夜はよく眠れ、朝の立ち上がりも落ち着いていました。', createdDay: day(0), time: '8:10' }
      ],
      timeline: [
        { icon: '👨', title: '長男・誠さん', text: '玄関の手すり周りを片付けました。夕方の移動は私が見守ります。', date: dayLabel(-1), time: '21:00' },
        { icon: '👩', title: '奈緒さん', text: '連絡帳と着替えを送迎バッグに入れました。今日は薄手の上着も持参します。', date: dayLabel(0), time: '7:35' }
      ],
      incomingShares: [
        { source: 'hospital', icon: '📋', title: 'リハシステム連携（デモ）・退院時サマリ', text: '退院時FIMは運動68/91点、認知31/35点。食事は自立、立ち上がり・移乗・入浴は見守りが必要という架空の評価設定です。', date: dayLabel(-9), time: '10:20' },
        { source: 'hospital', icon: '📈', title: 'リハシステム連携（デモ）・最終リハビリ評価', text: 'BBS 34/56点、10m快適歩行21.6秒（歩行器）の架空データ。方向転換と疲労後のふらつきを重点項目として共有しています。', date: dayLabel(-8), time: '14:05' },
        { source: 'hospital', icon: '🎯', title: 'リハシステム連携（デモ）・在宅での継続目標', text: '椅子に座って安全に鉢植えの世話を続け、立ち上がりと方向転換は家族が近くで見守ることを共有しています。', date: dayLabel(-7), time: '11:40' },
        { source: 'hospital', icon: '🏥', title: '彩北リハビリテーション病院・若林PT', text: '疲れた日の方向転換は小さく急がず、いったん立ち止まってから向きを変える方法を続けてください。', date: dayLabel(-4), time: '11:20' },
        { source: 'care', icon: '🌸', title: 'ケアホーム結の庭・橋本介護職', text: '午前の体操に最後まで参加。午後は休憩を挟み、椅子に座って園芸活動を楽しまれました。', date: dayLabel(-1), time: '15:55' }
      ],
      members: [
        { id: 3101, type: 'family', name: '藤本 誠', role: '管理者・長男', contact: '', note: '同居・夜間の見守り' },
        { id: 3102, type: 'family', name: '藤本 奈緒', role: '長男の妻', contact: '', note: '施設との連絡担当' },
        { id: 3103, type: 'family', name: '藤本 杏', role: '孫', contact: '', note: '園芸活動を担当' },
        { id: 3104, type: 'hospital', name: '庄司 玲子', role: 'リハビリテーション科医', contact: '', note: '彩北リハビリテーション病院' },
        { id: 3105, type: 'hospital', name: '若林 健', role: '理学療法士', contact: '', note: '彩北リハビリテーション病院' },
        { id: 3106, type: 'care', name: '大野 智美', role: 'ケアマネジャー', contact: '', note: '結の庭ケアサポート' },
        { id: 3107, type: 'care', name: '橋本 亮', role: '介護職', contact: '', note: 'ケアホーム結の庭' }
      ],
      events: [
        { id: 3101, type: 'care', title: 'ケアホーム結の庭', date: day(0), time: '09:30', owner: '奈緒', note: '入浴・体操・園芸' },
        { id: 3102, type: 'family', title: '鉢植えの水やり', date: day(0), time: '16:30', owner: '杏', note: '椅子を準備' },
        { id: 3103, type: 'hospital', title: '退院後外来', date: day(7), time: '11:00', owner: '誠', note: '彩北リハビリテーション病院' }
      ],
      shopping: [
        { id: 3101, name: '滑りにくい室内履き', detail: 'かかと付き', owner: '誠', done: false },
        { id: 3102, name: '軽い水差し', detail: '500ml程度', owner: '杏', done: false },
        { id: 3103, name: '薄手の上着', detail: '施設用', owner: '奈緒', done: true },
        { id: 3104, name: '送迎バッグの名札', detail: '大きめ文字', owner: '奈緒', done: true }
      ],
      selectedDate: day(0), calendarMonth: day(0).slice(0, 7)
    }
  };
})();
