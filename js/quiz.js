let currentQuizData = null;
let currentQuestionIndex = 0;
let quizScore = 0;
let optionSelected = false;

function initQuiz(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        document.getElementById('quiz-container').innerHTML = `
            <div class="empty-state-card">
                <h3>Invalid Quiz Data</h3>
                <p>The AI didn't return a valid quiz format.</p>
                <button class="auth-btn" style="background-color: var(--accent-color); margin-top: 1rem;" onclick="regenerateCurrentTab()">✨ Try Again</button>
            </div>
        `;
        return;
    }
    
    currentQuizData = data;
    currentQuestionIndex = 0;
    quizScore = 0;
    
    renderQuizQuestion();
}

function renderQuizQuestion() {
    const container = document.getElementById('quiz-container');
    
    if (currentQuestionIndex >= currentQuizData.length) {
        // Quiz Complete State
        const percentage = Math.round((quizScore / currentQuizData.length) * 100);
        let feedback = "Good effort!";
        if (percentage === 100) feedback = "Perfect Score! 🌟";
        else if (percentage >= 80) feedback = "Great job! 📚";
        
        container.innerHTML = `
            <div class="quiz-card" style="text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
                <h2 style="margin-bottom: 1rem; color: var(--ink-color);">Quiz Complete</h2>
                <div class="quiz-score-display">${quizScore} / ${currentQuizData.length} (${percentage}%)</div>
                <p style="color: #666; font-size: 1.1rem; margin-bottom: 2rem;">${feedback}</p>
                <button class="auth-btn" style="padding: 1rem 2rem; font-size: 1.1rem;" onclick="initQuiz({quiz: currentQuizData})">↻ Retake Quiz</button>
            </div>
        `;
        return;
    }
    
    optionSelected = false;
    const q = currentQuizData[currentQuestionIndex];
    
    let optionsHtml = '';
    q.options.forEach((opt, idx) => {
        optionsHtml += `<button class="quiz-option" id="quiz-opt-${idx}" onclick="selectQuizOption(${idx}, ${q.correctAnswerIndex})">${opt}</button>`;
    });
    
    // Convert accent color to RGB for the badge to resolve dynamically based on active theme
    container.innerHTML = `
        <div class="quiz-card" style="animation: fadeSlideUp 0.3s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <span class="badge" style="background: rgba(var(--accent-color-rgb, 160, 82, 45), 0.1); color: var(--accent-color); border: 1px solid rgba(var(--accent-color-rgb, 160, 82, 45), 0.2);">
                    Question ${currentQuestionIndex + 1} of ${currentQuizData.length}
                </span>
                <span style="font-weight: 700; color: var(--ink-color); opacity: 0.7;">Score: ${quizScore}</span>
            </div>
            
            <div class="quiz-question">${q.question}</div>
            
            <div class="quiz-options">
                ${optionsHtml}
            </div>
            
            <div id="quiz-explanation" class="quiz-explanation">
                <strong>Explanation:</strong> ${q.explanation}
            </div>
            
            <div id="quiz-next-block" style="margin-top: 2rem; text-align: right; display: none;">
                <button class="auth-btn" onclick="nextQuizQuestion()">Next Question →</button>
            </div>
        </div>
    `;
}

function selectQuizOption(selectedIndex, correctIndex) {
    if (optionSelected) return; // Prevent multiple selections
    optionSelected = true;
    
    // Highlight correct and wrong options
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => {
        opt.disabled = true;
        opt.style.cursor = 'default';
    });
    
    options[correctIndex].classList.add('correct');
    
    if (selectedIndex === correctIndex) {
        quizScore++;
    } else {
        options[selectedIndex].classList.add('wrong');
    }
    
    // Show explanation and next button
    document.getElementById('quiz-explanation').classList.add('visible');
    document.getElementById('quiz-next-block').style.display = 'block';
}

function nextQuizQuestion() {
    currentQuestionIndex++;
    renderQuizQuestion();
}
